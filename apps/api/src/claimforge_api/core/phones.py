"""Phone number normalization to E.164.

Numbers are stored in one canonical form so they compare, deduplicate and dial reliably:
``+15125550142``, or with an extension in RFC 3966 style: ``+15125550142;ext=204``.

Without a leading ``+`` a number is read as North American (NANP), the market most
organizations here work in; any other number must include its country code. This is a
deliberately small rule set, not a full numbering-plan database: it rejects what is
clearly wrong and leaves carrier-level validity to the phone network.
"""

import re

# "ext. 204", "extension 204", "x204", "#204" or an already-canonical ";ext=204".
_EXTENSION = re.compile(r"\s*(?:;\s*ext=|ext\.?|extension|x|#)\s*(\d{1,6})\s*$", re.IGNORECASE)
_ALLOWED = re.compile(r"\+?[\d\s().\-/]+")
# NANP: area code and exchange both start with 2-9.
_NANP = re.compile(r"1?([2-9]\d{2}[2-9]\d{6})")

E164_MAX_DIGITS = 15
E164_MIN_DIGITS = 7


class InvalidPhoneNumberError(ValueError):
    pass


def normalize_phone(raw: str) -> str:
    """Return ``raw`` in canonical E.164 form, or raise :class:`InvalidPhoneNumberError`."""
    text = raw.strip()
    extension = None
    if match := _EXTENSION.search(text):
        extension = match.group(1)
        text = text[: match.start()]
    text = text.strip()

    if not _ALLOWED.fullmatch(text):
        raise InvalidPhoneNumberError(
            "A phone number may only contain digits, spaces, a leading +, and ( ) - . /"
        )
    digits = re.sub(r"\D", "", text)

    if text.startswith("+"):
        if not E164_MIN_DIGITS <= len(digits) <= E164_MAX_DIGITS or digits.startswith("0"):
            raise InvalidPhoneNumberError(
                "An international number is a country code and 7 to 15 digits in total"
            )
        number = f"+{digits}"
    elif nanp := _NANP.fullmatch(digits):
        number = f"+1{nanp.group(1)}"
    else:
        raise InvalidPhoneNumberError(
            "Not a valid North American number. For other countries include the country "
            "code, e.g. +44 20 7946 0958"
        )
    return f"{number};ext={extension}" if extension else number
