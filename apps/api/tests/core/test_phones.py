import pytest

from claimforge_api.core.phones import InvalidPhoneNumberError, normalize_phone


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("(512) 555-0142", "+15125550142"),
        ("512.555.0142", "+15125550142"),
        ("1-512-555-0142", "+15125550142"),
        ("  +1 512 555 0142  ", "+15125550142"),
        ("+44 20 7946 0958", "+442079460958"),
        ("+49 (30) 901820", "+4930901820"),
        ("512-555-0142 ext. 204", "+15125550142;ext=204"),
        ("512-555-0142 x204", "+15125550142;ext=204"),
        ("512-555-0142 #9", "+15125550142;ext=9"),
        ("+15125550142;ext=204", "+15125550142;ext=204"),
    ],
)
def test_normalizes_to_e164(raw: str, expected: str) -> None:
    assert normalize_phone(raw) == expected


def test_canonical_form_is_stable() -> None:
    once = normalize_phone("(512) 555-0142 ext 7")
    assert normalize_phone(once) == once


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "call me",
        "555-0142",  # no area code
        "(012) 555-0142",  # area codes never start with 0 or 1
        "(512) 155-0142",  # neither do exchanges
        "44 20 7946 0958",  # international without +
        "+0 123 4567 890",  # country codes never start with 0
        "+1 234",  # too short
        "+1234567890123456",  # 16 digits: longer than E.164 allows
        "512+555-0142",  # + only at the start
        "512-555-0142 ext. 1234567",  # extension too long
    ],
)
def test_rejects_invalid_numbers(raw: str) -> None:
    with pytest.raises(InvalidPhoneNumberError):
        normalize_phone(raw)
