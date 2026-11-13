from typing import Any

import pytest
from pydantic import ValidationError

from claimforge_api.core.addresses import (
    AddressInput,
    InvalidAddressError,
    is_po_box,
    normalize_country,
    normalize_postal_code,
    normalize_region,
    normalize_street,
    normalize_unit,
)


def address(**fields: Any) -> AddressInput:
    defaults = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}
    return AddressInput.model_validate(defaults | fields)


# ─── Streets ──────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("raw", "street", "unit"),
    [
        ("123 main street", "123 Main St", None),
        ("123 MAIN STREET", "123 Main St", None),
        ("123 Main St.", "123 Main St", None),
        ("  123   Main    St  ", "123 Main St", None),
        ("4500 north lamar boulevard", "4500 N Lamar Blvd", None),
        ("901 E. 5th St.", "901 E 5th St", None),
        ("77 Commerce Street South", "77 Commerce St S", None),
        ("2210 N.W. Military Hwy", "2210 NW Military Hwy", None),
        ("12 Oak Avenue, Apartment 4b", "12 Oak Ave", "Apt 4B"),
        ("12 Oak Ave Suite 200", "12 Oak Ave", "Ste 200"),
        ("12 Oak Ave #3", "12 Oak Ave", "#3"),
        ("12 Oak Ave # 3", "12 Oak Ave", "#3"),
        ("12 Oak Ave Bldg C Unit 7", "12 Oak Ave", "Bldg C Unit 7"),
        ("12 Oak Ave Rear", "12 Oak Ave", "Rear"),
        ("P.O. Box 1234", "PO Box 1234", None),
        ("post office box 9", "PO Box 9", None),
    ],
)
def test_us_streets(raw: str, street: str, unit: str | None) -> None:
    assert normalize_street(raw, "US") == (street, unit)


@pytest.mark.parametrize(
    "raw",
    [
        "123 Avenue B",  # "Avenue" is the name here, not a suffix
        "15 North St",  # "North" is the name of the street
        "100 W Front",  # "Front" is the name, not a unit
        "8 Park Place Ln",  # only the last word is a suffix
        "350 Fifth Ave",
        "1 McDonald Dr",  # deliberate mixed case is kept
        "40 Unit Rd",  # too short to hold a unit
    ],
)
def test_ambiguous_streets_are_left_alone(raw: str) -> None:
    assert normalize_street(raw, "US") == (raw, None)


def test_non_us_streets_are_only_tidied() -> None:
    assert normalize_street("10  rue de la paix", "FR") == ("10 Rue De La Paix", None)
    assert normalize_street("221B Baker Street", "GB") == ("221B Baker Street", None)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("apartment 4b", "Apt 4B"),
        ("Suite 200", "Ste 200"),
        ("unit c", "Unit C"),
        ("# 12", "#12"),
        ("basement", "Bsmt"),
        ("c/o Dana Whitfield", "c/o Dana Whitfield"),
        ("", None),
        (None, None),
    ],
)
def test_us_unit_lines(raw: str | None, expected: str | None) -> None:
    assert normalize_unit(raw, "US") == expected


def test_po_boxes_are_detected() -> None:
    assert is_po_box("P.O. Box 12")
    assert is_po_box("po box 12")
    assert not is_po_box("12 Box Elder Ln")


# ─── Country, region, postal code ─────────────────────────────────────────────


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("us", "US"), ("USA", "US"), ("United States", "US"), ("canada", "CA"), ("de", "DE")],
)
def test_countries(raw: str, expected: str) -> None:
    assert normalize_country(raw) == expected


def test_unknown_country_format() -> None:
    with pytest.raises(InvalidAddressError, match="two-letter"):
        normalize_country("Germany")


@pytest.mark.parametrize(
    ("raw", "country", "expected"),
    [
        ("tx", "US", "TX"),
        ("Texas", "US", "TX"),
        ("new york", "US", "NY"),
        ("Washington D.C.", "US", "DC"),
        ("Puerto Rico", "US", "PR"),
        ("AE", "US", "AE"),
        ("Ontario", "CA", "ON"),
        ("Québec", "CA", "QC"),
        ("bavaria", "DE", "Bavaria"),
        (None, "DE", None),
    ],
)
def test_regions(raw: str | None, country: str, expected: str | None) -> None:
    assert normalize_region(raw, country) == expected


@pytest.mark.parametrize(
    ("raw", "country", "match"),
    [
        (None, "US", "state is required"),
        ("Texass", "US", "Unknown state"),
        ("XX", "CA", "province"),
    ],
)
def test_invalid_regions(raw: str | None, country: str, match: str) -> None:
    with pytest.raises(InvalidAddressError, match=match):
        normalize_region(raw, country)


@pytest.mark.parametrize(
    ("raw", "country", "expected"),
    [
        ("78701", "US", "78701"),
        ("78701-1234", "US", "78701-1234"),
        ("787011234", "US", "78701-1234"),
        ("78701 1234", "US", "78701-1234"),
        ("k1a0b1", "CA", "K1A 0B1"),
        ("K1A-0B1", "CA", "K1A 0B1"),
        ("sw1a 1aa", "GB", "SW1A 1AA"),
        (None, "IE", None),
    ],
)
def test_postal_codes(raw: str | None, country: str, expected: str | None) -> None:
    assert normalize_postal_code(raw, country) == expected


@pytest.mark.parametrize(
    ("raw", "country"),
    [
        (None, "US"),
        ("7870", "US"),
        ("78701-12", "US"),
        ("D1A 0B1", "CA"),  # D is never used
        ("W1A 0B1", "CA"),  # W never starts a code
        ("12$45", "GB"),
    ],
)
def test_invalid_postal_codes(raw: str | None, country: str) -> None:
    with pytest.raises(InvalidAddressError):
        normalize_postal_code(raw, country)


# ─── The whole address ────────────────────────────────────────────────────────


def test_unit_on_line1_moves_to_line2() -> None:
    result = address(line1="123 north main street apt 4b", city="AUSTIN", region="texas")

    assert (result.line1, result.line2, result.city, result.region) == (
        "123 N Main St",
        "Apt 4B",
        "Austin",
        "TX",
    )


def test_normalizing_twice_changes_nothing() -> None:
    once = address(line1="12 oak avenue suite 200", line2="rear", postal_code="787011234")
    twice = AddressInput.model_validate(once.model_dump())

    assert twice == once
    assert once.line2 == "Ste 200 Rear"


def test_equivalent_spellings_share_a_key() -> None:
    typed = address(line1="123 north main street apt 4b", postal_code="78701-1234")
    tidy = address(line1="123 N Main St", line2="Apt 4B", city="austin")
    other_unit = address(line1="123 N Main St", line2="Apt 5")

    assert typed.to_address().key == tidy.to_address().key == "us|78701|123 n main st|apt 4b"
    assert other_unit.to_address().key != tidy.to_address().key


def test_formatted_address() -> None:
    us = address(line1="123 N Main St", line2="Apt 4B").to_address()
    canada = AddressInput(
        line1="290 Bremner Blvd", city="Toronto", region="ON", postal_code="m5v3l9", country="CA"
    ).to_address()

    assert us.formatted == "123 N Main St Apt 4B, Austin, TX 78701"
    assert canada.formatted == "290 Bremner Blvd, Toronto, ON M5V 3L9, Canada"


def test_addresses_without_postal_codes_key_on_city() -> None:
    dublin = AddressInput(line1="1 Main St", city="Dublin", country="IE").to_address()

    assert dublin.key == "ie|dublin|1 main st|"


@pytest.mark.parametrize(
    ("fields", "field"),
    [
        ({"postal_code": "7870"}, "postal_code"),
        ({"postal_code": None}, "postal_code"),
        ({"region": "Texass"}, "region"),
        ({"region": None}, "region"),
        ({"country": "Germany"}, "country"),
        ({"line1": "  "}, "line1"),
        ({"city": ""}, "city"),
        ({"county": "Travis"}, "county"),
    ],
)
def test_errors_point_at_the_field(fields: dict[str, Any], field: str) -> None:
    with pytest.raises(ValidationError) as caught:
        address(**fields)

    assert [error["loc"] for error in caught.value.errors()] == [(field,)]


def test_bad_country_does_not_cascade_into_other_errors() -> None:
    with pytest.raises(ValidationError) as caught:
        address(country="Germany", region="Nowhere", postal_code="?")

    assert [error["loc"] for error in caught.value.errors()] == [("country",)]
