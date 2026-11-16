"""Report templates: how an organization's reports look, kind by kind."""

from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin

DEFAULT_ACCENT = "#1F4E79"


class ReportKind(StrEnum):
    PHOTO = "photo_report"
    DRYING = "drying_report"


def _in(column: str, values: type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(sorted(repr(v.value) for v in values))})"


class ReportTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "report_templates"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    #: Fixed once created: the options belong to the kind.
    kind: Mapped[ReportKind] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(100))
    #: On the cover: "Photo Report", "Drying Log".
    title: Mapped[str | None] = mapped_column(String(200), default=None)
    #: Company name, address, phone: the top of every page.
    header_text: Mapped[str | None] = mapped_column(Text, default=None)
    #: Licence numbers, disclaimers: the bottom of every page.
    footer_text: Mapped[str | None] = mapped_column(Text, default=None)
    accent_color: Mapped[str] = mapped_column(String(7), default=DEFAULT_ACCENT)
    #: Checked against the kind's options schema (reports/schemas.py) before it's stored.
    options: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))

    __table_args__ = (
        Index(
            "uq_report_templates_organization_id_name",
            "organization_id",
            func.lower(name),
            unique=True,
        ),
        # At most one default per kind.
        Index(
            "uq_report_templates_default",
            "organization_id",
            "kind",
            unique=True,
            postgresql_where=text("is_default"),
        ),
        CheckConstraint(_in("kind", ReportKind), name="kind_valid"),
        CheckConstraint("accent_color ~ '^#[0-9A-Fa-f]{6}$'", name="accent_color_valid"),
        CheckConstraint("btrim(name) <> ''", name="name_not_blank"),
    )
