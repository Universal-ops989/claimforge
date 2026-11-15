"""HMAC signatures for storage URLs the API serves itself (the local backend)."""

import hashlib
import hmac
import json

#: Separates this key from every other use of the secret it is derived from.
_PURPOSE = b"claimforge-storage-urls-v1"


class UrlSigner:
    """Signs a sequence of strings; any change to any of them breaks the signature."""

    def __init__(self, secret: bytes) -> None:
        self._key = hmac.new(secret, _PURPOSE, hashlib.sha256).digest()

    def sign(self, *parts: str) -> str:
        # JSON keeps the parts apart: ("a/b", "c") and ("a", "b/c") sign differently.
        message = json.dumps(parts, separators=(",", ":")).encode("utf-8")
        return hmac.new(self._key, message, hashlib.sha256).hexdigest()

    def verify(self, signature: str, *parts: str) -> bool:
        return hmac.compare_digest(self.sign(*parts), signature)
