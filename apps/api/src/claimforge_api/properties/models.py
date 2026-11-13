"""Property: the place where a loss happened (the loss location)."""

from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, SmallInteger, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from claimforge_api.core.addresses import Address
from claimforge_api.db.base import Base
from claimforge_api.db.mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class PropertyType(StrEnum):
    RESIDENTIAL = "residential"
    MULTI_FAMILY = "multi_family"
    COMMERCIAL = "commercial"
    INDUSTRIAL = "industrial"
    OTHER = "other"


class Property(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Stored once per organization; every claim at the same address points here."""

    __tablename__ = "properties"
    __audited__ = True
    __audit_entity__ = "property"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )

    # A normalized address (see core.addresses), stored flat so it can be indexed.
    address_line1: Mapped[str] = mapped_column(String(200))
    address_line2: Mapped[str | None] = mapped_column(String(100), default=None)
    city: Mapped[str] = mapped_column(String(100))
    region: Mapped[str | None] = mapped_column(String(100), default=None)
    postal_code: Mapped[str | None] = mapped_column(String(16), default=None)
    country: Mapped[str] = mapped_column(String(2))
    # Equal for equivalent spellings of one address; unique per organization.
    address_key: Mapped[str] = mapped_column(String(500))

    property_type: Mapped[PropertyType] = mapped_column(String(20))
    # Homes built before 1978 may contain lead paint; asbestos is likelier before 1980.
    year_built: Mapped[int | None] = mapped_column(SmallInteger, default=None)
    # Optional coordinates supplied by the client (no geocoding on the server).
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6, asdecimal=False), default=None)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6, asdecimal=False), default=None)
    # Gate codes, lockbox, pets, parking: what a field tech needs before arriving.
    access_notes: Mapped[str | None] = mapped_column(Text, default=None)

    __table_args__ = (
        CheckConstraint(
            f"property_type IN ({', '.join(repr(t.value) for t in PropertyType)})",
            name="property_type_valid",
        ),
        CheckConstraint("country ~ '^[A-Z]{2}$'", name="country_format"),
        CheckConstraint("year_built BETWEEN 1600 AND 2100", name="year_built_range"),
        CheckConstraint(
            "(latitude IS NULL) = (longitude IS NULL)"
            " AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180",
            name="coordinates_valid",
        ),
        Index(
            "uq_properties_address_live",
            "organization_id",
            "address_key",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        # Serves the newest-first listing of live properties.
        Index(
            "ix_properties_organization_id_live",
            "organization_id",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    @property
    def address(self) -> Address:
        return Address(
            line1=self.address_line1,
            line2=self.address_line2,
            city=self.city,
            region=self.region,
            postal_code=self.postal_code,
            country=self.country,
        )

    @address.setter
    def address(self, value: Address) -> None:
        self.address_line1 = value.line1
        self.address_line2 = value.line2
        self.city = value.city
        self.region = value.region
        self.postal_code = value.postal_code
        self.country = value.country
        self.address_key = value.key

    def __repr__(self) -> str:
        return f"<Property {self.address_line1}, {self.city}>"
