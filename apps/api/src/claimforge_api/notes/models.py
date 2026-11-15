"""Notes on a claim, and the members each note mentions."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.claims.models import Claim
from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.users.models import User


class Note(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "notes"
    __audited__ = True

    # Denormalized from the claim so tenant scoping and the audit log need no join.
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    author_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    # Mentions appear as <@user-id> tokens (see notes.mentions).
    body: Mapped[str] = mapped_column(Text)
    # Set when the author changes the body; null for a note never edited.
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    claim: Mapped[Claim] = relationship(lazy="raise")
    author: Mapped[User | None] = relationship(lazy="raise")
    # Derived from the body on every write, so they are not audited separately.
    mentions: Mapped[list["NoteMention"]] = relationship(
        back_populates="note",
        cascade="all, delete-orphan",
        lazy="raise",
        order_by="NoteMention.id",
    )

    __table_args__ = (
        # A claim's notes, newest first (UUIDv7 ids follow insert order).
        Index("ix_notes_claim_id_id", "claim_id", "id"),
    )

    @property
    def mentioned_users(self) -> list[User]:
        return [mention.user for mention in self.mentions]


class NoteMention(UUIDPrimaryKeyMixin, Base):
    """One member mentioned in one note."""

    __tablename__ = "note_mentions"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    note_id: Mapped[UUID] = mapped_column(ForeignKey("notes.id", ondelete="CASCADE"))
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    note: Mapped[Note] = relationship(back_populates="mentions", lazy="raise")
    user: Mapped[User] = relationship(lazy="raise")

    __table_args__ = (
        UniqueConstraint("note_id", "user_id"),
        # "Notes that mention me", newest first.
        Index("ix_note_mentions_organization_id_user_id", "organization_id", "user_id", "note_id"),
    )
