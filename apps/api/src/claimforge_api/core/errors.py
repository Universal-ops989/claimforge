"""Domain exceptions.

Services raise these; the HTTP layer turns them into RFC 9457 problem responses. They
carry no HTTP or framework types, so services stay testable without a web server.
"""

from typing import Any, ClassVar


class AppError(Exception):
    """Base class for expected, client-facing errors."""

    status: ClassVar[int] = 400
    code: ClassVar[str] = "bad_request"
    title: ClassVar[str] = "Bad request"

    def __init__(self, detail: str | None = None, **extra: Any) -> None:
        super().__init__(detail or self.title)
        self.detail = detail or self.title
        # Additional, safe-to-expose context (e.g. {"claim_id": "..."}).
        self.extra = extra
        # Extra HTTP response headers, e.g. Retry-After (not part of the body).
        self.headers: dict[str, str] = {}


class NotFoundError(AppError):
    status = 404
    code = "not_found"
    title = "Not found"


class ConflictError(AppError):
    """The request conflicts with the current state (duplicate, stale version)."""

    status = 409
    code = "conflict"
    title = "Conflict"


class AuthenticationRequiredError(AppError):
    status = 401
    code = "authentication_required"
    title = "Authentication required"


class PermissionDeniedError(AppError):
    status = 403
    code = "permission_denied"
    title = "Permission denied"


class BusinessRuleError(AppError):
    """Valid input that breaks a domain rule, e.g. closing a claim with open tasks."""

    status = 422
    code = "business_rule_violation"
    title = "Business rule violated"
