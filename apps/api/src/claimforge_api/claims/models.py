"""Claims: one loss at one property, and the people involved in it."""

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.contacts.models import Contact
from claimforge_api.db.base import Base
from claimforge_api.db.mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.properties.models import Property
from claimforge_api.users.models import User


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


class AssignmentRole(StrEnum):
    """What a member does on a claim. A claim has at most one adjuster."""

    ADJUSTER = "adjuster"
    CONTRACTOR = "contractor"
    FIELD_TECHNICIAN = "field_technician"


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
    assignments: Mapped[list["ClaimAssignment"]] = relationship(
        back_populates="claim",
        cascade="all, delete-orphan",
        lazy="raise",
        order_by="ClaimAssignment.id",
    )
    # Read-only shortcut for lists: the member who owns the claim.
    adjuster: Mapped[User | None] = relationship(
        secondary="claim_assignments",
        primaryjoin="and_(Claim.id == ClaimAssignment.claim_id, "
        "ClaimAssignment.role == 'adjuster')",
        secondaryjoin="ClaimAssignment.user_id == User.id",
        viewonly=True,
        uselist=False,
        lazy="raise",
    )
    # Read-only shortcut for lists, which show only the person to call first.
    primary_contact: Mapped["ClaimContact | None"] = relationship(
        primaryjoin="and_(Claim.id == ClaimContact.claim_id, ClaimContact.is_primary)",
        viewonly=True,
        uselist=False,
        lazy="raise",
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "number"),
        CheckConstraint(_one_of("status", ClaimStatus), name="status_valid"),
        CheckConstraint(_one_of("loss_type", LossType), name="loss_type_valid"),
        # Serve the claim list's sort orders over live claims; each is scanned either way.
        Index(
            "ix_claims_organization_id_live",
            "organization_id",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_claims_organization_id_loss_date_live",
            "organization_id",
            "loss_date",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_claims_organization_id_updated_at_live",
            "organization_id",
            "updated_at",
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


class ClaimStatusChange(UUIDPrimaryKeyMixin, Base):
    """One step in a claim's status history. Rows are never changed or removed."""

    __tablename__ = "claim_status_changes"

    # Denormalized from the claim so tenant scoping needs no join.
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    from_status: Mapped[ClaimStatus] = mapped_column(String(20))
    to_status: Mapped[ClaimStatus] = mapped_column(String(20))
    reason: Mapped[str | None] = mapped_column(Text, default=None)
    changed_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    changed_by: Mapped[User | None] = relationship(lazy="raise")

    __table_args__ = (
        CheckConstraint(_one_of("from_status", ClaimStatus), name="from_status_valid"),
        CheckConstraint(_one_of("to_status", ClaimStatus), name="to_status_valid"),
        CheckConstraint("from_status <> to_status", name="statuses_differ"),
        # A claim's history in order (UUIDv7 ids follow insert order).
        Index("ix_claim_status_changes_claim_id", "claim_id", "id"),
    )


class ClaimAssignment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An organization member working a claim in one role."""

    __tablename__ = "claim_assignments"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[AssignmentRole] = mapped_column(String(20))
    assigned_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )

    claim: Mapped[Claim] = relationship(back_populates="assignments", lazy="raise")
    user: Mapped[User] = relationship(foreign_keys=[user_id], lazy="raise")

    __table_args__ = (
        # Only members can be assigned, and leaving the organization ends their assignments.
        ForeignKeyConstraint(
            ["organization_id", "user_id"],
            ["memberships.organization_id", "memberships.user_id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("claim_id", "user_id"),
        CheckConstraint(_one_of("role", AssignmentRole), name="role_valid"),
        Index(
            "uq_claim_assignments_adjuster",
            "claim_id",
            unique=True,
            postgresql_where=text("role = 'adjuster'"),
        ),
        # "Claims assigned to me".
        Index("ix_claim_assignments_organization_id_user_id", "organization_id", "user_id"),
    )
