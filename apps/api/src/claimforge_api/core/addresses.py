"""Postal address normalization.

Addresses are stored in one canonical form, so the same house typed two ways
("123 north main street apt 4b" / "123 N Main St, Apt 4B") is recognised as one place and
reports print consistently. The rules are deliberately conservative and offline: no
geocoding, no address database. When a word is ambiguous it is left as typed.

- Countries are ISO 3166-1 alpha-2 codes.
- US: USPS state codes, ZIP / ZIP+4, and USPS Publication 28 abbreviations for street
  suffixes ("Street" -> "St"), directionals ("North" -> "N") and unit designators
  ("Apartment" -> "Apt"). A unit typed at the end of line 1 moves to line 2.
- Canada: province codes and "A1A 1A1" postal codes.
- Elsewhere: whitespace and casing are tidied; region and postal code are free text.
"""

import re
from dataclasses import dataclass
from typing import Annotated, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationInfo,
    field_validator,
    model_validator,
)


class InvalidAddressError(ValueError):
    pass


# ─── Reference data ───────────────────────────────────────────────────────────

COUNTRY_NAMES = {"US": "United States", "CA": "Canada"}
_COUNTRY_ALIASES = {
    "usa": "US",
    "u.s.": "US",
    "u.s.a.": "US",
    "united states": "US",
    "united states of america": "US",
    "canada": "CA",
}

US_STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin",
    "WY": "Wyoming",
    "DC": "District of Columbia",
    "AS": "American Samoa", "GU": "Guam", "MP": "Northern Mariana Islands",
    "PR": "Puerto Rico", "VI": "U.S. Virgin Islands",
    "AA": "Armed Forces Americas", "AE": "Armed Forces Europe", "AP": "Armed Forces Pacific",
}  # fmt: skip
_US_STATE_ALIASES = {"washington dc": "DC", "virgin islands": "VI", "us virgin islands": "VI"}

CA_PROVINCES = {
    "AB": "Alberta", "BC": "British Columbia", "MB": "Manitoba", "NB": "New Brunswick",
    "NL": "Newfoundland and Labrador", "NS": "Nova Scotia", "NT": "Northwest Territories",
    "NU": "Nunavut", "ON": "Ontario", "PE": "Prince Edward Island", "QC": "Quebec",
    "SK": "Saskatchewan", "YT": "Yukon",
}  # fmt: skip
_CA_PROVINCE_ALIASES = {"newfoundland": "NL", "québec": "QC", "yukon territory": "YT"}

# USPS Publication 28, appendix C1 (the common subset), plus frequent misspellings.
STREET_SUFFIXES = {
    "alley": "Aly", "aly": "Aly", "avenue": "Ave", "ave": "Ave", "av": "Ave",
    "bend": "Bnd", "bnd": "Bnd", "boulevard": "Blvd", "blvd": "Blvd",
    "circle": "Cir", "cir": "Cir", "commons": "Cmns", "cmns": "Cmns",
    "court": "Ct", "ct": "Ct", "cove": "Cv", "cv": "Cv", "creek": "Crk", "crk": "Crk",
    "crescent": "Cres", "cres": "Cres", "crossing": "Xing", "xing": "Xing",
    "drive": "Dr", "dr": "Dr", "estates": "Ests", "ests": "Ests",
    "expressway": "Expy", "expy": "Expy", "freeway": "Fwy", "fwy": "Fwy",
    "glen": "Gln", "gln": "Gln", "grove": "Grv", "grv": "Grv",
    "heights": "Hts", "hts": "Hts", "highway": "Hwy", "hwy": "Hwy",
    "hollow": "Holw", "holw": "Holw", "lane": "Ln", "ln": "Ln",
    "landing": "Lndg", "lndg": "Lndg", "loop": "Loop", "meadows": "Mdws", "mdws": "Mdws",
    "parkway": "Pkwy", "pkwy": "Pkwy", "pass": "Pass", "path": "Path", "pike": "Pike",
    "place": "Pl", "pl": "Pl", "plaza": "Plz", "plz": "Plz", "point": "Pt", "pt": "Pt",
    "ridge": "Rdg", "rdg": "Rdg", "road": "Rd", "rd": "Rd", "row": "Row", "run": "Run",
    "square": "Sq", "sq": "Sq", "street": "St", "st": "St", "str": "St",
    "terrace": "Ter", "ter": "Ter", "trail": "Trl", "trl": "Trl",
    "turnpike": "Tpke", "tpke": "Tpke", "walk": "Walk", "way": "Way",
}  # fmt: skip

DIRECTIONALS = {
    "north": "N", "n": "N", "south": "S", "s": "S", "east": "E", "e": "E",
    "west": "W", "w": "W", "northeast": "NE", "ne": "NE", "northwest": "NW", "nw": "NW",
    "southeast": "SE", "se": "SE", "southwest": "SW", "sw": "SW",
}  # fmt: skip

# Pub 28 appendix C2. These are followed by a number or letter: "Apt 4B".
UNIT_DESIGNATORS = {
    "apartment": "Apt", "apt": "Apt", "building": "Bldg", "bldg": "Bldg",
    "department": "Dept", "dept": "Dept", "floor": "Fl", "fl": "Fl",
    "lot": "Lot", "office": "Ofc", "ofc": "Ofc", "penthouse": "Ph", "ph": "Ph",
    "room": "Rm", "rm": "Rm", "space": "Spc", "spc": "Spc", "suite": "Ste", "ste": "Ste",
    "trailer": "Trlr", "trlr": "Trlr", "unit": "Unit",
}  # fmt: skip
# These stand alone: "123 Main St Rear".
UNIT_WORDS = {
    "basement": "Bsmt", "bsmt": "Bsmt", "front": "Frnt", "frnt": "Frnt",
    "lower": "Lowr", "lowr": "Lowr", "rear": "Rear", "upper": "Uppr", "uppr": "Uppr",
}  # fmt: skip


def _index(codes: dict[str, str], aliases: dict[str, str]) -> dict[str, str]:
    """Lower-case code or name -> code."""
    index = {code.lower(): code for code in codes}
    index |= {name.lower().replace(".", ""): code for code, name in codes.items()}
    return index | aliases


_US_STATE_INDEX = _index(US_STATES, _US_STATE_ALIASES)
_CA_PROVINCE_INDEX = _index(CA_PROVINCES, _CA_PROVINCE_ALIASES)

_US_ZIP = re.compile(r"(\d{5})(?:[-\s]?(\d{4}))?")
# Canadian postal codes never use D, F, I, O, Q or U, and never start with W or Z.
_CA_POSTAL = re.compile(r"([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])[\s-]?(\d[ABCEGHJ-NPRSTV-Z]\d)")
_OTHER_POSTAL = re.compile(r"[A-Z0-9][A-Z0-9 \-]{0,14}")
_PO_BOX = re.compile(r"^(?:p\.?\s*o\.?|post\s+office)\s*box\s+(\S+)$", re.IGNORECASE)
_DOTTED = re.compile(r"(?:[A-Za-z]\.)+[A-Za-z]?\.?")
_ORDINAL = re.compile(r"\d+(?:st|nd|rd|th)", re.IGNORECASE)


# ─── Text helpers ─────────────────────────────────────────────────────────────


def _tidy(text: str) -> str:
    """Collapse whitespace, drop commas and trailing periods ("St." -> "St", "N.W." -> "NW")."""
    tokens = []
    for token in text.replace(",", " ").split():
        if _DOTTED.fullmatch(token):
            token = token.replace(".", "")
        token = token.rstrip(".")
        if token:
            tokens.append(token)
    return " ".join(tokens)


def _recase_word(word: str) -> str:
    if any(c.isdigit() for c in word):
        # "12th" stays lower; house numbers and unit values like "4b" go upper.
        return word.lower() if _ORDINAL.fullmatch(word) else word.upper()
    return "-".join(part.capitalize() for part in word.split("-"))


def _recase(text: str) -> str:
    """Title-case text typed in all caps or all lower case; leave deliberate casing alone."""
    if not any(c.isalpha() for c in text) or not (text.isupper() or text.islower()):
        return text
    return " ".join(_recase_word(word) for word in text.split())


def _clean(text: str) -> str:
    return _recase(_tidy(text))


# ─── Field normalizers ────────────────────────────────────────────────────────


def normalize_country(value: str) -> str:
    text = " ".join(value.split())
    if alias := _COUNTRY_ALIASES.get(text.lower()):
        return alias
    if not re.fullmatch(r"[A-Za-z]{2}", text):
        raise InvalidAddressError("Use a two-letter ISO country code, e.g. US or CA")
    return text.upper()


def normalize_region(value: str | None, country: str) -> str | None:
    text = " ".join(value.split()) if value else ""
    if country in ("US", "CA"):
        index, label = (
            (_US_STATE_INDEX, "state") if country == "US" else (_CA_PROVINCE_INDEX, "province")
        )
        if not text:
            raise InvalidAddressError(f"A {label} is required")
        code = index.get(text.lower().replace(".", ""))
        if code is None:
            raise InvalidAddressError(f"Unknown {label} '{text}'")
        return code
    return _recase(text) or None


def normalize_postal_code(value: str | None, country: str) -> str | None:
    text = " ".join(value.split()).upper() if value else ""
    if country == "US":
        match = _US_ZIP.fullmatch(text)
        if not match:
            raise InvalidAddressError("A ZIP code has 5 digits, optionally followed by -1234")
        zip5, plus4 = match.groups()
        return f"{zip5}-{plus4}" if plus4 else zip5
    if country == "CA":
        match = _CA_POSTAL.fullmatch(text)
        if not match:
            raise InvalidAddressError("A Canadian postal code looks like K1A 0B1")
        return f"{match.group(1)} {match.group(2)}"
    if not text:
        return None
    if not _OTHER_POSTAL.fullmatch(text):
        raise InvalidAddressError("A postal code may contain letters, digits, spaces and -")
    return text


def is_po_box(line: str) -> bool:
    return bool(_PO_BOX.match(_tidy(line)))


def _split_unit(tokens: list[str]) -> tuple[list[str], list[str]]:
    """Peel unit designators off the end of a street line: "... St Apt 4B" -> Apt 4B."""
    unit: list[str] = []
    while len(tokens) > 2:
        last, before = tokens[-1], tokens[-2].lower()
        if last.startswith("#") and len(last) > 1:
            unit, tokens = [f"#{last[1:].upper()}", *unit], tokens[:-1]
        elif before == "#":
            unit, tokens = [f"#{last.upper()}", *unit], tokens[:-2]
        elif before in UNIT_DESIGNATORS and len(tokens) > 3:
            unit, tokens = [UNIT_DESIGNATORS[before], last.upper(), *unit], tokens[:-2]
        elif last.lower() in UNIT_WORDS and before in STREET_SUFFIXES:
            unit, tokens = [UNIT_WORDS[last.lower()], *unit], tokens[:-1]
        else:
            break
    return tokens, unit


def _abbreviate_street(tokens: list[str]) -> list[str]:
    """Pub 28 suffix and directional abbreviations, only where the position is unambiguous."""
    tokens = list(tokens)
    start = 1 if tokens and any(c.isdigit() for c in tokens[0]) else 0
    end = len(tokens)  # tokens[start:end] is the street name (plus suffix)

    # Post-directional, only after a suffix: "Main St North" -> "Main St N".
    if (
        end - start >= 3
        and tokens[end - 1].lower() in DIRECTIONALS
        and tokens[end - 2].lower() in STREET_SUFFIXES
    ):
        tokens[end - 1] = DIRECTIONALS[tokens[end - 1].lower()]
        end -= 1
    # Suffix, only after at least one name word: "Avenue B" and "Street" stay as typed.
    has_suffix = end - start >= 2 and tokens[end - 1].lower() in STREET_SUFFIXES
    if has_suffix:
        tokens[end - 1] = STREET_SUFFIXES[tokens[end - 1].lower()]
        end -= 1
    # Pre-directional, only before a name word: "North Main St" -> "N Main St",
    # but "North St" keeps its name.
    if end - start >= 2 and tokens[start].lower() in DIRECTIONALS:
        tokens[start] = DIRECTIONALS[tokens[start].lower()]
    return tokens


def normalize_street(line: str, country: str) -> tuple[str, str | None]:
    """Return (street line, unit split off the end of it or None)."""
    text = _clean(line)
    if match := _PO_BOX.match(text):
        return f"PO Box {match.group(1).upper()}", None
    if country != "US":
        return text, None
    tokens, unit = _split_unit(text.split())
    return " ".join(_abbreviate_street(tokens)), " ".join(unit) or None


def normalize_unit(line: str | None, country: str) -> str | None:
    """Line 2: "apartment 4b" -> "Apt 4B" (US); otherwise only tidied."""
    text = _clean(line) if line else ""
    if not text:
        return None
    tokens = text.split()
    if country == "US":
        first = tokens[0].lower()
        if first in UNIT_DESIGNATORS and len(tokens) == 2:
            return f"{UNIT_DESIGNATORS[first]} {tokens[1].upper()}"
        if first in UNIT_WORDS and len(tokens) == 1:
            return UNIT_WORDS[first]
        if re.fullmatch(r"#\s*\S+", text):
            return f"#{text[1:].strip().upper()}"
    return text


# ─── The whole address ────────────────────────────────────────────────────────


def _key_part(text: str | None) -> str:
    return " ".join(re.sub(r"[^a-z0-9#]+", " ", (text or "").lower()).split())


@dataclass(frozen=True)
class Address:
    """A normalized address."""

    line1: str
    line2: str | None
    city: str
    region: str | None
    postal_code: str | None
    country: str

    @property
    def key(self) -> str:
        """Equal for equivalent addresses: the street, the unit, and ZIP5 / postal code / city."""
        if self.country == "US" and self.postal_code:
            place = self.postal_code[:5]
        else:
            place = _key_part(self.postal_code) or _key_part(self.city)
        parts = [self.country.lower(), place, _key_part(self.line1), _key_part(self.line2)]
        return "|".join(parts)

    @property
    def formatted(self) -> str:
        """One line: "123 N Main St Apt 4B, Austin, TX 78701"."""
        street = " ".join(p for p in (self.line1, self.line2) if p)
        locality = " ".join(p for p in (self.region, self.postal_code) if p)
        parts = [street, self.city, locality]
        if self.country != "US":
            parts.append(COUNTRY_NAMES.get(self.country, self.country))
        return ", ".join(p for p in parts if p)


Line = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]


class AddressInput(BaseModel):
    """An address as typed. Validation normalizes it; errors name the offending field."""

    model_config = ConfigDict(extra="forbid")

    # Declared first: the fields below are validated against the country.
    country: Annotated[str, StringConstraints(max_length=60)] = "US"
    line1: Line
    line2: ShortText | None = None
    city: Annotated[ShortText, StringConstraints(min_length=1)]
    # Validated even when omitted: US and Canadian addresses require them.
    region: ShortText | None = Field(default=None, validate_default=True)
    postal_code: Annotated[str, StringConstraints(max_length=16)] | None = Field(
        default=None, validate_default=True
    )

    @field_validator("country")
    @classmethod
    def _country(cls, value: str) -> str:
        return normalize_country(value)

    @field_validator("city")
    @classmethod
    def _city(cls, value: str) -> str:
        return _clean(value)

    @field_validator("region", mode="after")
    @classmethod
    def _region(cls, value: str | None, info: ValidationInfo) -> str | None:
        country = info.data.get("country")
        return normalize_region(value, country) if country else value

    @field_validator("postal_code", mode="after")
    @classmethod
    def _postal_code(cls, value: str | None, info: ValidationInfo) -> str | None:
        country = info.data.get("country")
        return normalize_postal_code(value, country) if country else value

    @model_validator(mode="after")
    def _street(self) -> Self:
        line1, unit = normalize_street(self.line1, self.country)
        line2 = normalize_unit(self.line2, self.country)
        self.line1 = line1
        self.line2 = " ".join(p for p in (unit, line2) if p) or None
        return self

    def to_address(self) -> Address:
        return Address(
            line1=self.line1,
            line2=self.line2,
            city=self.city,
            region=self.region,
            postal_code=self.postal_code,
            country=self.country,
        )
