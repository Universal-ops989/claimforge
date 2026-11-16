"""Top-level router that mounts every feature router."""

from fastapi import APIRouter

from claimforge_api.api.routes import health
from claimforge_api.audit.router import router as audit_router
from claimforge_api.auth.router import router as auth_router
from claimforge_api.claims.router import router as claims_router
from claimforge_api.contacts.router import router as contacts_router
from claimforge_api.damage.router import router as damage_router
from claimforge_api.documents.router import router as documents_router
from claimforge_api.equipment.router import claim_router as equipment_placements_router
from claimforge_api.equipment.router import router as equipment_router
from claimforge_api.estimates.router import router as estimates_router
from claimforge_api.invitations.router import accept_router as invitation_accept_router
from claimforge_api.invitations.router import organization_router as invitations_router
from claimforge_api.moisture.router import router as moisture_router
from claimforge_api.notes.router import router as notes_router
from claimforge_api.organizations.router import router as organizations_router
from claimforge_api.photos.router import organization_router as photo_tags_router
from claimforge_api.photos.router import router as photos_router
from claimforge_api.pricing.router import router as pricing_router
from claimforge_api.properties.router import router as properties_router
from claimforge_api.reports.router import router as reports_router
from claimforge_api.search.router import router as search_router
from claimforge_api.storage.router import router as storage_router
from claimforge_api.structures.router import router as structures_router
from claimforge_api.tasks.router import router as tasks_router
from claimforge_api.timeline.router import router as timeline_router
from claimforge_api.users.router import router as users_router

# Business endpoints are versioned so breaking changes can ship as /v2 side by side.
v1_router = APIRouter(prefix="/v1")
v1_router.include_router(auth_router)
v1_router.include_router(organizations_router)
v1_router.include_router(invitations_router)
v1_router.include_router(invitation_accept_router)
v1_router.include_router(users_router)
v1_router.include_router(contacts_router)
v1_router.include_router(equipment_router)
v1_router.include_router(pricing_router)
v1_router.include_router(reports_router)
v1_router.include_router(properties_router)
v1_router.include_router(claims_router)
v1_router.include_router(structures_router)
v1_router.include_router(damage_router)
v1_router.include_router(photos_router)
v1_router.include_router(photo_tags_router)
v1_router.include_router(documents_router)
v1_router.include_router(moisture_router)
v1_router.include_router(equipment_placements_router)
v1_router.include_router(estimates_router)
v1_router.include_router(notes_router)
v1_router.include_router(tasks_router)
v1_router.include_router(timeline_router)
v1_router.include_router(search_router)
v1_router.include_router(audit_router)
v1_router.include_router(storage_router)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(v1_router)
