import pytest

from claimforge_api.core.passwords import (
    PasswordHasher,
    WeakPasswordError,
    check_password_policy,
)

# Cheap parameters keep unit tests fast; the production cost is checked separately.
FAST = PasswordHasher(log_n=10)


def test_hash_round_trip() -> None:
    encoded = FAST.hash("correct horse battery staple")

    assert encoded.startswith("$scrypt$ln=10,r=8,p=1$")
    assert FAST.verify("correct horse battery staple", encoded)
    assert not FAST.verify("correct horse battery stapler", encoded)


def test_hashes_are_salted() -> None:
    assert FAST.hash("same password") != FAST.hash("same password")


def test_verifies_hashes_made_with_other_parameters() -> None:
    old = PasswordHasher(log_n=9).hash("long enough password")

    assert FAST.verify("long enough password", old)
    assert FAST.needs_rehash(old)
    assert not FAST.needs_rehash(FAST.hash("long enough password"))


@pytest.mark.parametrize(
    "encoded",
    [
        "",
        "plaintext",
        "$argon2id$v=19$m=65536,t=3,p=4$abc$def",
        "$scrypt$ln=40,r=8,p=1$c2FsdA$aGFzaA",  # absurd cost must not be attempted
    ],
)
def test_rejects_malformed_or_hostile_hashes(encoded: str) -> None:
    assert not FAST.verify("whatever password", encoded)


def test_default_parameters_meet_owasp_minimum() -> None:
    default = PasswordHasher()

    assert (2**default.log_n, default.r, default.p) >= (2**17, 8, 1)


@pytest.mark.parametrize(
    ("password", "message"),
    [
        ("short", "at least 12"),
        ("x" * 129, "at most 128"),
        ("ana.rivera-2026!", "email"),
    ],
)
def test_policy_rejects_weak_passwords(password: str, message: str) -> None:
    with pytest.raises(WeakPasswordError, match=message):
        check_password_policy(password, email="ana.rivera@example.com")


def test_policy_accepts_long_passphrases() -> None:
    check_password_policy("tile grout and drywall", email="ana@example.com")
