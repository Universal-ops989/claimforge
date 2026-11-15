"""Shared by the photo tests: a claim with storage, and someone photographing it."""

from pathlib import Path
from typing import Any
from uuid import UUID

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.storage.conftest import local_storage

from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.claims.schemas import ClaimCreate
from claimforge_api.photos import service
from claimforge_api.photos.models import Photo, PhotoUpload
from claimforge_api.photos.schemas import PhotoUploadCreate
from claimforge_api.storage.base import ObjectStorage
from claimforge_api.storage.local import LocalStorage
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}
JPEG = b"\xff\xd8\xff\xe0 a kitchen ceiling"
MAX_BYTES = 1024 * 1024


def describe(data: bytes = JPEG, **fields: Any) -> PhotoUploadCreate:
    body = {"filename": "IMG_0412.jpg", "content_type": "image/jpeg", "size_bytes": len(data)}
    return PhotoUploadCreate.model_validate(body | fields)


class Site:
    """One claim, its storage, and someone photographing it."""

    def __init__(
        self,
        session: AsyncSession,
        storage: LocalStorage,
        organization_id: UUID,
        claim: Claim,
        user: User,
    ) -> None:
        self.session, self.storage = session, storage
        self.organization_id, self.claim, self.user = organization_id, claim, user

    def by(self, user: User) -> "Site":
        return Site(self.session, self.storage, self.organization_id, self.claim, user)

    async def start(self, data: bytes = JPEG, **fields: Any) -> PhotoUpload:
        upload, _ = await service.start_upload(
            self.session,
            self.storage,
            self.organization_id,
            self.claim.id,
            describe(data, **fields),
            user=self.user,
            max_bytes=MAX_BYTES,
        )
        return upload

    async def send(self, upload: PhotoUpload, data: bytes = JPEG, content_type: str = "") -> None:
        """What the client does with the signed link."""
        await self.storage.put(
            upload.storage_key, data, content_type=content_type or upload.content_type
        )

    async def complete(self, upload_id: UUID) -> tuple[Photo, bool]:
        return await service.complete_upload(
            self.session,
            self.storage,
            self.organization_id,
            self.claim.id,
            upload_id,
            user=self.user,
        )

    async def photo(self, data: bytes = JPEG, **fields: Any) -> Photo:
        upload = await self.start(data, **fields)
        await self.send(upload, data)
        photo, _ = await self.complete(upload.id)
        return photo

    async def photos(self) -> list[Photo]:
        page = await service.list_photos(
            self.session,
            self.organization_id,
            self.claim.id,
            user=self.user,
            limit=50,
            cursor=None,
        )
        return page.items

    async def delete(self, photo: Photo, storage: ObjectStorage | None = None) -> None:
        await service.delete_photo(
            self.session,
            storage or self.storage,
            self.organization_id,
            self.claim.id,
            photo.id,
            user=self.user,
        )


async def open_claim(session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    data = ClaimCreate.model_validate({"loss_type": "water", "property": {"address": ADDRESS}})
    return await claims.create_claim(session, organization_id, data, user=user)


@pytest.fixture
async def site(db_session: AsyncSession, organization_id: UUID, user: User, tmp_path: Path) -> Site:
    claim = await open_claim(db_session, organization_id, user)
    return Site(db_session, local_storage(tmp_path), organization_id, claim, user)


async def member(site: Site, role: Role) -> User:
    person = await users.create_user(
        site.session, email=f"{role}@example.com", full_name=f"A {role}"
    )
    site.session.add(Membership(organization_id=site.organization_id, user_id=person.id, role=role))
    await site.session.commit()
    return person


async def count(session: AsyncSession, model: type[Photo] | type[PhotoUpload]) -> int:
    return int(await session.scalar(select(func.count()).select_from(model)) or 0)
