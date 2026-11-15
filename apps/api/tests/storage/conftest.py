"""Backends under test. Every test that takes ``storage`` runs against each of them."""

from pathlib import Path

import pytest

from claimforge_api.storage.base import ObjectStorage
from claimforge_api.storage.local import LocalStorage
from claimforge_api.storage.signing import UrlSigner

SECRET = b"storage-test-secret"


def local_storage(root: Path) -> LocalStorage:
    return LocalStorage(root, signer=UrlSigner(SECRET), base_url="http://testserver/")


@pytest.fixture(params=["local"])
def storage(request: pytest.FixtureRequest, tmp_path: Path) -> ObjectStorage:
    match request.param:
        case "local":
            return local_storage(tmp_path / "storage")
        case backend:
            raise AssertionError(f"Unknown backend: {backend}")
