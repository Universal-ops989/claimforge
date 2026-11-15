"""Backends under test. Every test that takes ``storage`` runs against each of them.

S3 is moto's server on a free local port: real HTTP, so presigned URLs can be followed.
"""

from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import boto3
import pytest
from botocore.config import Config
from moto.server import ThreadedMotoServer
from pydantic import SecretStr

from claimforge_api.core.settings import Settings, StorageBackend
from claimforge_api.storage.base import ObjectStorage
from claimforge_api.storage.local import LocalStorage
from claimforge_api.storage.s3 import S3Storage, create_client
from claimforge_api.storage.signing import UrlSigner

SECRET = b"storage-test-secret"
#: Nothing listens on port 1, on any platform.
NOWHERE = "http://127.0.0.1:1"


def local_storage(root: Path) -> LocalStorage:
    return LocalStorage(root, signer=UrlSigner(SECRET), base_url="http://testserver/")


@pytest.fixture(scope="session")
def s3_endpoint() -> Iterator[str]:
    server = ThreadedMotoServer(ip_address="127.0.0.1", port=0, verbose=False)
    server.start()
    host, port = server.get_host_and_port()
    yield f"http://{host}:{port}"
    server.stop()


def s3_settings(endpoint: str, *, region: str = "us-east-1") -> Settings:
    return Settings(
        _env_file=None,
        storage_backend=StorageBackend.S3,
        s3_endpoint_url=endpoint,
        s3_region=region,
        # A bucket of its own for every test.
        s3_bucket=f"test-{uuid4().hex[:16]}",
        s3_access_key="test",
        s3_secret_key=SecretStr("test"),
    )


async def s3_storage(settings: Settings) -> S3Storage:
    storage = S3Storage(create_client(settings), settings.s3_bucket)
    await storage.prepare(cors_origins=[])
    return storage


def unreachable_storage() -> S3Storage:
    """A bucket on a server that isn't there, given up on after one attempt."""
    client = boto3.session.Session().client(
        "s3",
        endpoint_url=NOWHERE,
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",
        config=Config(retries={"total_max_attempts": 1}, connect_timeout=1),
    )
    return S3Storage(client, "media")


@pytest.fixture(params=["local", "s3"])
async def storage(request: pytest.FixtureRequest, tmp_path: Path) -> ObjectStorage:
    match request.param:
        case "local":
            return local_storage(tmp_path / "storage")
        case "s3":
            return await s3_storage(s3_settings(request.getfixturevalue("s3_endpoint")))
        case backend:
            raise AssertionError(f"Unknown backend: {backend}")
