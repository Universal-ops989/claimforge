"""Claims: one loss at one property, and the people involved in it."""

from datetime import date
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    false,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.contacts.models import Contact
from claimforge_api.db.base import Base
from claimforge_api.db.mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.properties.models import Property


class ClaimStatus(StrEnum):
    """Lifecycle states. Which transitions are allowed is defined by the status workflow."""

    NEW = "new"
    INSPECTED = "inspected"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class LossType(StrEnum):
    WATER = "water"
    FIRE = "fire"
    SMOKE = "smoke"
    MOLD = "mold"
    WIND = "wind"
    HAIL = "hail"
    STORM = "storm"
    FLOOD = "flood"
    SEWAGE = "sewage"
    IMPACT = "impact"
    VANDALISM = "vandalism"
    OTHER = "other"


class ClaimContactRole(StrEnum):
    INSURED = "insured"
    CO_INSURED = "co_insured"
    TENANT = "tenant"
    PROPERTY_MANAGER = "property_manager"
    PUBLIC_ADJUSTER = "public_adjuster"
    INSURANCE_AGENT = "insurance_agent"
    CARRIER_ADJUSTER = "carrier_adjuster"
    OTHER = "other"


def _one_of(column: str, values: type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(repr(v.value) for v in values)})"


class Claim(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "claims"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    # Ours, unique per organization and never reused: "2026-00042".
    number: Mapped[str] = mapped_column(String(20))
    property_id: Mapped[UUID] = mapped_column(
        ForeignKey("properties.id", ondelete="RESTRICT"), index=True
    )
    status: Mapped[ClaimStatus] = mapped_column(String(20), server_default=ClaimStatus.NEW.value)
    loss_type: Mapped[LossType] = mapped_column(String(20))
    loss_date: Mapped[date | None] = mapped_column(Date, default=None)
    description: Mapped[str | None] = mapped_column(Text, default=None)

    # The insurer's identifiers, as they appear on the carrier's paperwork.
    carrier_name: Mapped[str | None] = mapped_column(String(200), default=None)
    carrier_claim_number: Mapped[str | None] = mapped_column(String(64), default=None)
    policy_number: Mapped[str | None] = mapped_column(String(64), default=None)

    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )

    property: Mapped[Property] = relationship(lazy="raise")
    contacts: Mapped[list["ClaimContact"]] = relationship(
        back_populates="claim",
        cascade="all, delete-orphan",
        lazy="raise",
        order_by="ClaimContact.id",
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "number"),
        CheckConstraint(_one_of("status", ClaimStatus), name="status_valid"),
        CheckConstraint(_one_of("loss_type", LossType), name="loss_type_valid"),
        # Serves newest-first listings of live claims.
        Index(
            "ix_claims_organization_id_live",
            "organization_id",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    def __repr__(self) -> str:
        return f"<Claim {self.number}>"


class ClaimContact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A contact's role on one claim. The same person can be the insured on one claim and
    the tenant on another."""

    __tablename__ = "claim_contacts"
    __audited__ = True

    # Denormalized from the claim so tenant scoping and the audit log need no join.
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    contact_id: Mapped[UUID] = mapped_column(
        ForeignKey("contacts.id", ondelete="RESTRICT"), index=True
    )
    role: Mapped[ClaimContactRole] = mapped_column(String(32))
    is_primary: Mapped[bool] = mapped_column(Boolean, server_default=false(), default=False)

    claim: Mapped[Claim] = relationship(back_populates="contacts", lazy="raise")
    contact: Mapped[Contact] = relationship(lazy="raise")

    __table_args__ = (
        UniqueConstraint("claim_id", "contact_id"),
        CheckConstraint(_one_of("role", ClaimContactRole), name="role_valid"),
        # The person to call first.
        Index(
            "uq_claim_contacts_primary",
            "claim_id",
            unique=True,
            postgresql_where=text("is_primary"),
        ),
    )


class ClaimCounter(Base):
    """The last claim number issued per organization and year (see claims.numbering)."""

    __tablename__ = "claim_counters"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True
    )
    year: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    last_number: Mapped[int] = mapped_column(Integer)
