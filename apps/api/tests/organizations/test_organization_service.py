import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.organizations import service
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.users.models import User


@pytest.mark.parametrize(
    ("name", "slug"),
    [
        ("Rivera & Sons Restoration, LLC", "rivera-sons-restoration-llc"),
        ("  Café Água  ", "cafe-agua"),
        ("!!!", "organization"),
        ("x" * 80, "x" * 63),
    ],
)
def test_slugify(name: str, slug: str) -> None:
    assert service.slugify(name) == slug


async def test_derived_slugs_are_deduplicated(db_session: AsyncSession, user: User) -> None:
    created = [
        await service.create_organization(
            db_session, OrganizationCreate(name="Acme Water"), owner=user
        )
        for _ in range(3)
    ]

    assert [o.slug for o in created] == ["acme-water", "acme-water-2", "acme-water-3"]


async def test_explicit_taken_slug_conflicts(db_session: AsyncSession, user: User) -> None:
    await service.create_organization(
        db_session, OrganizationCreate(name="A", slug="dryco"), owner=user
    )

    with pytest.raises(service.SlugTakenError):
        await service.create_organization(
            db_session, OrganizationCreate(name="B", slug="dryco"), owner=user
        )


async def test_race_on_insert_becomes_a_conflict(
    db_session: AsyncSession, user: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Simulate another request winning the slug between our check and our insert."""

    async def never_taken(_session: AsyncSession, _slug: str) -> bool:
        return False

    await service.create_organization(
        db_session, OrganizationCreate(name="A", slug="racer"), owner=user
    )
    monkeypatch.setattr(service, "_slug_in_use", never_taken)

    with pytest.raises(service.SlugTakenError) as caught:
        await service.create_organization(
            db_session, OrganizationCreate(name="B", slug="racer"), owner=user
        )
    assert isinstance(caught.value.__cause__, IntegrityError)
