"""The PDF engine: branded pages, numbering, safe text, and the facts on the cover."""

import io
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import UUID

import pytest
from PIL import Image
from pypdf import PdfReader
from pypdf.generic import DictionaryObject
from sqlalchemy.ext.asyncio import AsyncSession
from tests.storage.conftest import local_storage

from claimforge_api.claims import service as claims
from claimforge_api.claims.schemas import ClaimCreate
from claimforge_api.contacts import service as contacts
from claimforge_api.contacts.schemas import ContactCreate
from claimforge_api.core.errors import NotFoundError
from claimforge_api.reports import facts, service
from claimforge_api.reports.models import ReportKind
from claimforge_api.reports.pdf import Branding, Cover, Document, long_date, safe
from claimforge_api.reports.schemas import TemplateCreate
from claimforge_api.users.models import User

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


def png(size: tuple[int, int] = (400, 100)) -> bytes:
    out = io.BytesIO()
    Image.new("RGBA", size, (30, 60, 120, 255)).save(out, format="PNG")
    return out.getvalue()


def read(pdf: bytes) -> list[str]:
    return [page.extract_text() for page in PdfReader(io.BytesIO(pdf)).pages]


COVER = Cover(
    claim_number="2026-00042",
    loss_type="water",
    loss_date=date(2026, 11, 4),
    address="123 Main St, Austin, TX 78701",
    policyholder="Dana Whitfield",
    prepared_at=datetime(2026, 11, 16, 15, 0, tzinfo=UTC),
    prepared_by="Morgan Member",
)


def test_pages_carry_the_template() -> None:
    doc = Document(
        Branding(
            title="Photo Report",
            header_text="Rivera Restoration\n(512) 555-0100",
            footer_text="TX license #12345",
        )
    )
    doc.cover(COVER)
    doc.heading("Kitchen")
    doc.table(["Point", "Material"], [[str(n), "Drywall"] for n in range(120)], widths=[0.3, 0.7])

    pages = read(doc.render())

    assert len(pages) >= 3
    for number, text in enumerate(pages, start=1):
        assert "Rivera Restoration" in text
        assert "TX license #12345" in text
        assert f"Page {number} of {len(pages)}" in text
    cover = pages[0]
    for fact in ("Photo Report", "2026-00042", "Water", "November 4, 2026", "Dana Whitfield"):
        assert fact in cover
    assert "Prepared by" in cover
    # The table's header comes back on every page it runs over.
    assert all("Material" in text for text in pages[1:])


def test_text_is_text_not_markup() -> None:
    doc = Document(Branding(title="Report"))
    doc.paragraph("Moisture <b>not bold</b> & more\nnext line")
    doc.paragraph("Ωmega 漢字")

    [page] = read(doc.render())

    assert "<b>not bold</b> & more" in page
    assert "?mega ??" in page  # what the built-in fonts can't draw becomes "?"
    assert safe("a < b") == "a &lt; b"
    assert long_date(date(2026, 1, 5)) == "January 5, 2026"


def test_the_logo_is_on_every_page() -> None:
    doc = Document(Branding(title="Report", logo=png()))
    doc.paragraph("One")
    doc.add_page_break()
    doc.paragraph("Two")

    reader = PdfReader(io.BytesIO(doc.render()))

    for page in reader.pages:
        resources = page["/Resources"].get_object()
        assert isinstance(resources, DictionaryObject)
        assert "/XObject" in resources


# ─── Facts from the database ──────────────────────────────────────────────────


async def test_cover_facts(db_session: AsyncSession, organization_id: UUID, user: User) -> None:
    dana = await contacts.create_contact(
        db_session, organization_id, ContactCreate(full_name="Dana Whitfield"), user=user
    )
    claim = await claims.create_claim(
        db_session,
        organization_id,
        ClaimCreate.model_validate(
            {
                "loss_type": "water",
                "loss_date": "2026-11-04",
                "carrier_name": "Lone Star Mutual",
                "carrier_claim_number": "LSM-88213",
                "property": {"address": ADDRESS},
                "contacts": [{"contact_id": str(dana.id), "role": "insured", "is_primary": True}],
            }
        ),
        user=user,
    )

    found = await facts.cover(db_session, organization_id, claim.id, prepared_by=user)

    assert (found.claim_number, found.loss_date, found.policyholder) == (
        claim.number,
        date(2026, 11, 4),
        "Dana Whitfield",
    )
    assert found.address == "123 Main St, Austin, TX 78701"
    assert found.extra == [("Carrier", "Lone Star Mutual (claim LSM-88213)")]
    assert found.prepared_by == "Morgan Member"
    claim.soft_delete()
    await db_session.commit()
    with pytest.raises(NotFoundError):
        await facts.cover(db_session, organization_id, claim.id, prepared_by=None)


async def test_branding_from_the_default_template(
    db_session: AsyncSession, organization_id: UUID, user: User, tmp_path: Path
) -> None:
    storage = local_storage(tmp_path)
    built_in, options = await facts.branding(db_session, storage, organization_id, ReportKind.PHOTO)
    assert (built_in.title, built_in.logo, options["photos_per_page"]) == ("Photo Report", None, 2)

    template = await service.create_template(
        db_session,
        organization_id,
        TemplateCreate.model_validate(
            {
                "kind": "photo_report",
                "name": "Carrier",
                "title": "Site Photos",
                "footer_text": "TX license #12345",
                "accent_color": "#AA3300",
                "options": {"photos_per_page": 4},
                "is_default": True,
            }
        ),
        user=user,
    )
    await service.set_logo(db_session, storage, organization_id, template.id, png(), user=user)

    branded, options = await facts.branding(db_session, storage, organization_id, ReportKind.PHOTO)
    assert (branded.title, branded.accent, branded.footer_text) == (
        "Site Photos",
        "#AA3300",
        "TX license #12345",
    )
    assert branded.logo is not None
    assert options["photos_per_page"] == 4

    # A logo gone missing from storage: the report goes on without it.
    assert template.logo_key is not None
    await storage.delete(template.logo_key)
    without, _ = await facts.branding(db_session, storage, organization_id, ReportKind.PHOTO)
    assert without.logo is None
