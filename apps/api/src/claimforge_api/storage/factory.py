"""Builds the configured storage backend."""

from typing import assert_never

from claimforge_api.core.settings import Settings, StorageBackend
from claimforge_api.storage.base import ObjectStorage
from claimforge_api.storage.local import LocalStorage
from claimforge_api.storage.signing import UrlSigner


def create_storage(settings: Settings) -> ObjectStorage:
    """The backend ``settings`` choose. Does no I/O: directories appear on first write."""
    match settings.storage_backend:
        case StorageBackend.LOCAL:
            return LocalStorage(
                settings.storage_local_root,
                # The JWT secret is already required to be strong in production; the
                # signer derives its own key from it.
                signer=UrlSigner(settings.jwt_secret.get_secret_value().encode("utf-8")),
                base_url=settings.public_api_url,
            )
        case _:
            assert_never(settings.storage_backend)
