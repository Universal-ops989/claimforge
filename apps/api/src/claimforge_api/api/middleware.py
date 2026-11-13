"""ASGI middleware."""

import logging
import re
import time

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from claimforge_api.core.ids import uuid7
from claimforge_api.core.logging import request_id_var

REQUEST_ID_HEADER = "X-Request-ID"
# Accept caller-supplied ids only if they are short and plain, to avoid log injection.
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")

access_logger = logging.getLogger("claimforge.access")


class RequestContextMiddleware:
    """Assigns a request id, exposes it to logs and the response, and logs access.

    Pure ASGI (not BaseHTTPMiddleware) so it adds no task overhead and works with
    streaming responses.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = _header(scope, REQUEST_ID_HEADER.lower())
        request_id = incoming if incoming and _SAFE_REQUEST_ID.match(incoming) else str(uuid7())
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        status_code = 500

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                MutableHeaders(scope=message)[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            access_logger.info(
                "%s %s %s",
                scope["method"],
                scope["path"],
                status_code,
                extra={
                    "method": scope["method"],
                    "path": scope["path"],
                    "status": status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
            request_id_var.reset(token)


def _header(scope: Scope, name: str) -> str | None:
    for key, value in scope["headers"]:
        if key.decode("latin-1").lower() == name:
            return str(value.decode("latin-1"))
    return None
