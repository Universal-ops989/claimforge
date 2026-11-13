"""Password hashing with scrypt (memory-hard, from the standard library).

Hashes are self-describing strings: ``$scrypt$ln=17,r=8,p=1$<salt>$<hash>`` (base64 without
padding). Parameters follow the OWASP Password Storage Cheat Sheet minimum for scrypt
(N=2^17, r=8, p=1). Because parameters are stored with each hash, raising them later is
transparent: ``needs_rehash`` reports old hashes and they are upgraded on the next login.

scrypt comes from OpenSSL via ``hashlib``, so there is no native third-party dependency.
"""

import base64
import hashlib
import hmac
import os
import re
from dataclasses import dataclass

_PATTERN = re.compile(
    r"^\$scrypt\$ln=(?P<ln>\d+),r=(?P<r>\d+),p=(?P<p>\d+)\$(?P<salt>[A-Za-z0-9+/]+)\$(?P<hash>[A-Za-z0-9+/]+)$"
)


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.b64decode(text + "=" * (-len(text) % 4))


@dataclass(frozen=True)
class PasswordHasher:
    """scrypt with a CPU/memory cost of ``2**log_n``."""

    log_n: int = 17
    r: int = 8
    p: int = 1
    salt_bytes: int = 16
    hash_bytes: int = 32

    def _derive(self, password: str, salt: bytes, log_n: int, r: int, p: int) -> bytes:
        # scrypt needs 128 * r * N bytes; allow headroom over OpenSSL's 32 MiB default.
        maxmem = 128 * r * (2**log_n) * 2
        return hashlib.scrypt(
            password.encode(),
            salt=salt,
            n=2**log_n,
            r=r,
            p=p,
            maxmem=maxmem,
            dklen=self.hash_bytes,
        )

    def hash(self, password: str) -> str:
        salt = os.urandom(self.salt_bytes)
        digest = self._derive(password, salt, self.log_n, self.r, self.p)
        return f"$scrypt$ln={self.log_n},r={self.r},p={self.p}${_b64(salt)}${_b64(digest)}"

    def verify(self, password: str, encoded: str) -> bool:
        """Constant-time comparison. Malformed hashes verify as False."""
        match = _PATTERN.match(encoded)
        if match is None:
            return False
        ln, r, p = int(match["ln"]), int(match["r"]), int(match["p"])
        if not (1 <= ln <= 22 and 1 <= r <= 32 and 1 <= p <= 16):
            return False  # refuse absurd parameters that could exhaust memory
        expected = _unb64(match["hash"])
        actual = self._derive(password, _unb64(match["salt"]), ln, r, p)
        return hmac.compare_digest(actual, expected)

    def needs_rehash(self, encoded: str) -> bool:
        """True when the hash was made with different (usually weaker) parameters."""
        match = _PATTERN.match(encoded)
        if match is None:
            return True
        return (int(match["ln"]), int(match["r"]), int(match["p"])) != (
            self.log_n,
            self.r,
            self.p,
        )


#: Process-wide hasher. Tests swap in a cheaper one.
hasher = PasswordHasher()

#: A real hash of a random password, verified against when the user doesn't exist so that
#: "unknown email" takes as long as "wrong password".
_DUMMY_HASH = hasher.hash(_b64(os.urandom(18)))


def verify_dummy(password: str) -> None:
    hasher.verify(password, _DUMMY_HASH)


MIN_LENGTH = 12
MAX_LENGTH = 128


class WeakPasswordError(ValueError):
    pass


def check_password_policy(password: str, *, email: str | None = None) -> None:
    """Length limits (NIST SP 800-63B style) and no copying of the email's local part."""
    if len(password) < MIN_LENGTH:
        raise WeakPasswordError(f"Use at least {MIN_LENGTH} characters")
    if len(password) > MAX_LENGTH:
        raise WeakPasswordError(f"Use at most {MAX_LENGTH} characters")
    if email:
        local_part = email.split("@", 1)[0].lower()
        if len(local_part) >= 4 and local_part in password.lower():
            raise WeakPasswordError("The password must not contain your email address")
