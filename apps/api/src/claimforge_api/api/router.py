"""Top-level router that mounts every feature router."""

from fastapi import APIRouter

from claimforge_api.api.routes import health
from claimforge_api.audit.router import router as audit_router
from claimforge_api.auth.router import router as auth_router
from claimforge_api.contacts.router import router as contacts_router
from claimforge_api.invitations.router import accept_router as invitation_accept_router
from claimforge_api.invitations.router import organization_router as invitations_router
from claimforge_api.organizations.router import router as organizations_router
from claimforge_api.properties.router import router as properties_router
from claimforge_api.users.router import router as users_router

# Business endpoints are versioned so breaking changes can ship as /v2 side by side.
v1_router = APIRouter(prefix="/v1")
v1_router.include_router(auth_router)
v1_router.include_router(organizations_router)
v1_router.include_router(invitations_router)
v1_router.include_router(invitation_accept_router)
v1_router.include_router(users_router)
v1_router.include_router(contacts_router)
v1_router.include_router(properties_router)
v1_router.include_router(audit_router)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(v1_router)
