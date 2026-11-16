"""Response schemas shared by every kind of upload."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from claimforge_api.storage.base import SignedUpload


class SignedUploadRead(BaseModel):
    """Send the file as the body of this request, with these headers."""

    url: str
    method: Literal["PUT"]
    headers: dict[str, str]
    expires_at: datetime

    @classmethod
    def of(cls, signed: SignedUpload) -> "SignedUploadRead":
        return cls(
            url=signed.url,
            method=signed.method,
            headers=signed.headers,
            expires_at=signed.expires_at,
        )
