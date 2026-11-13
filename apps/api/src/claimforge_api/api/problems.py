"""RFC 9457 problem-details responses and the exception handlers that produce them."""

import logging
from http import HTTPStatus
from typing import Any, cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from claimforge_api.core.errors import AppError
from claimforge_api.core.logging import request_id_var

logger = logging.getLogger(__name__)

PROBLEM_MEDIA_TYPE = "application/problem+json"
PROBLEM_TYPE_BASE = "https://claimforge.dev/problems/"


class FieldError(BaseModel):
    """One invalid input field."""

    loc: list[str | int] = Field(description='Path to the field, e.g. ["body", "email"]')
    message: str
    type: str


class Problem(BaseModel):
    """RFC 9457 problem details, plus ClaimForge extensions."""

    type: str = Field(examples=["https://claimforge.dev/problems/not-found"])
    title: str
    status: int
    detail: str
    instance: str = Field(description="Path of the request that failed")
    code: str = Field(description="Stable, machine-readable error code")
    request_id: str | None = None
    errors: list[FieldError] | None = Field(default=None, description="Validation errors")


def problem_response(
    request: Request,
    *,
    status: int,
    code: str,
    title: str,
    detail: str,
    headers: dict[str, str] | None = None,
    **extensions: Any,
) -> JSONResponse:
    request_id = request_id_var.get() or getattr(request.state, "request_id", None)
    body: dict[str, Any] = {
        "type": PROBLEM_TYPE_BASE + code.replace("_", "-"),
        "title": title,
        "status": status,
        "detail": detail,
        "instance": request.url.path,
        "code": code,
        "request_id": request_id,
        **extensions,
    }
    response_headers = dict(headers or {})
    if request_id:
        response_headers["X-Request-ID"] = request_id
    return JSONResponse(
        body, status_code=status, media_type=PROBLEM_MEDIA_TYPE, headers=response_headers
    )


async def handle_app_error(request: Request, exc: Exception) -> JSONResponse:
    # Starlette only routes matching exception types to each handler.
    error = cast("AppError", exc)
    headers = dict(error.headers)
    if error.status == 401:
        # RFC 6750: tell clients which scheme to use and whether the token was the problem.
        challenge = "Bearer"
        if error.code in {"invalid_token", "token_expired"}:
            challenge += f' error="invalid_token", error_description="{error.title}"'
        headers["WWW-Authenticate"] = challenge
    return problem_response(
        request,
        status=error.status,
        code=error.code,
        title=error.title,
        detail=error.detail,
        headers=headers,
        **error.extra,
    )


async def handle_validation_error(request: Request, exc: Exception) -> JSONResponse:
    validation = cast("RequestValidationError", exc)
    errors = [
        {"loc": list(error["loc"]), "message": error["msg"], "type": error["type"]}
        for error in validation.errors()
    ]
    return problem_response(
        request,
        status=422,
        code="validation_failed",
        title="Invalid request",
        detail=f"{len(errors)} field(s) failed validation",
        errors=errors,
    )


async def handle_http_exception(request: Request, exc: Exception) -> JSONResponse:
    http_error = cast("StarletteHTTPException", exc)
    phrase = HTTPStatus(http_error.status_code).phrase
    # FastAPI's HTTPException allows any detail (e.g. a dict); only plain text is exposed.
    raw_detail: object = http_error.detail
    detail = raw_detail if isinstance(raw_detail, str) else phrase
    return problem_response(
        request,
        status=http_error.status_code,
        code=phrase.lower().replace(" ", "_").replace("-", "_"),
        title=phrase,
        detail=detail,
        headers=dict(http_error.headers) if http_error.headers else None,
    )


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # Log everything server-side; tell the client nothing about internals.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return problem_response(
        request,
        status=500,
        code="internal_error",
        title="Internal server error",
        detail="Something went wrong on our side. Quote the request id if you contact support.",
    )


def register_problem_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, handle_app_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    app.add_exception_handler(Exception, handle_unexpected_error)


#: For rate-limited routes: `responses=RATE_LIMITED_RESPONSE`.
RATE_LIMITED_RESPONSE: dict[int | str, dict[str, Any]] = {
    429: {
        "model": Problem,
        "content": {PROBLEM_MEDIA_TYPE: {}},
        "description": "Too many requests; retry after the Retry-After header's seconds",
        "headers": {"Retry-After": {"schema": {"type": "integer"}}},
    }
}

# Shared OpenAPI documentation for routers: `responses=PROBLEM_RESPONSES`.
PROBLEM_RESPONSES: dict[int | str, dict[str, Any]] = {
    status: {"model": Problem, "content": {PROBLEM_MEDIA_TYPE: {}}, "description": description}
    for status, description in {
        400: "Bad request",
        401: "Authentication required",
        403: "Permission denied",
        404: "Not found",
        409: "Conflict",
        422: "Validation failed or business rule violated",
    }.items()
}
