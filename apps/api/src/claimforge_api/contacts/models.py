"""Contact: a person or business an organization deals with on claims."""

from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class ContactKind(StrEnum):
    """Who the contact usually is. A claim records each contact's role on that claim."""

    POLICYHOLDER = "policyholder"
    TENANT = "tenant"
    PROPERTY_MANAGER = "property_manager"
    PUBLIC_ADJUSTER = "public_adjuster"
    INSURANCE_AGENT = "insurance_agent"
    CARRIER_ADJUSTER = "carrier_adjuster"
    CONTRACTOR = "contractor"
    OTHER = "other"


class ContactMethod(StrEnum):
    EMAIL = "email"
    PHONE = "phone"
    TEXT = "text"


def _one_of(column: str, values: type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(repr(v.value) for v in values)})"


class Contact(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "contacts"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    kind: Mapped[ContactKind] = mapped_column(String(32))
    # A person's name, or the business name when the contact is a company.
    full_name: Mapped[str] = mapped_column(String(200))
    company_name: Mapped[str | None] = mapped_column(String(200), default=None)
    email: Mapped[str | None] = mapped_column(String(254), default=None)
    # E.164, optionally with an RFC 3966 extension: "+15125550142;ext=204".
    phone: Mapped[str | None] = mapped_column(String(32), default=None)
    preferred_contact_method: Mapped[ContactMethod | None] = mapped_column(
        String(16), default=None
    )
    notes: Mapped[str | None] = mapped_column(Text, default=None)

    __table_args__ = (
        CheckConstraint(_one_of("kind", ContactKind), name="kind_valid"),
        CheckConstraint(
            _one_of("preferred_contact_method", ContactMethod), name="preferred_method_valid"
        ),
        # Serves the alphabetical directory listing of live contacts.
        Index(
            "ix_contacts_organization_id_full_name_live",
            "organization_id",
            "full_name",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    def __repr__(self) -> str:
        return f"<Contact {self.full_name}>"
