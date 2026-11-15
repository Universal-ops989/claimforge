"""The S3 backend's own behaviour: presigned URLs, setup, health and configuration."""

from datetime import timedelta

import httpx2
import pytest
from pydantic import SecretStr, ValidationError
from tests.storage.conftest import NOWHERE, s3_settings, s3_storage, unreachable_storage

from claimforge_api.core.settings import Settings, StorageBackend
from claimforge_api.main import create_app
from claimforge_api.storage import __main__ as setup_command
from claimforge_api.storage.base import StorageUnavailableError
from claimforge_api.storage.factory import create_storage
from claimforge_api.storage.s3 import S3Storage, create_client

KEY = "org/claim/photo.jpg"
HOUR = timedelta(hours=1)


async def test_presigned_urls_go_straight_to_the_bucket(s3_endpoint: str) -> None:
    storage = await s3_storage(s3_settings(s3_endpoint))
    upload = await storage.upload_url(KEY, content_type="image/jpeg", expires_in=HOUR)
    assert upload.url.startswith(f"{s3_endpoint}/test-")

    async with httpx2.AsyncClient() as client:
        put = await client.put(upload.url, content=b"jpeg bytes", headers=upload.headers)
        assert put.status_code == 200
        url = await storage.download_url(KEY, expires_in=HOUR, filename="Kitchen.jpg")
        downloaded = await client.get(url)

    assert downloaded.content == b"jpeg bytes"
    assert downloaded.headers["content-type"] == "image/jpeg"
    assert downloaded.headers["content-disposition"] == (
        "attachment; filename=\"Kitchen.jpg\"; filename*=UTF-8''Kitchen.jpg"
    )


async def test_prepare_creates_the_bucket_and_allows_the_web_apps(s3_endpoint: str) -> None:
    settings = s3_settings(s3_endpoint, region="eu-west-1")
    storage = S3Storage(create_client(settings), settings.s3_bucket)
    with pytest.raises(StorageUnavailableError, match="does not exist"):
        await storage.ping()

    origins = ["https://app.example.com"]
    await storage.prepare(cors_origins=origins)
    await storage.prepare(cors_origins=origins)  # again: nothing changes

    await storage.ping()
    client = create_client(settings)
    assert client.get_bucket_location(Bucket=settings.s3_bucket)["LocationConstraint"] == (
        "eu-west-1"
    )
    [rule] = client.get_bucket_cors(Bucket=settings.s3_bucket)["CORSRules"]
    assert rule["AllowedOrigins"] == origins
    assert rule["AllowedMethods"] == ["GET", "HEAD", "PUT"]


async def test_failures_surface_as_unavailable() -> None:
    storage = unreachable_storage()

    with pytest.raises(StorageUnavailableError):
        await storage.stat(KEY)
    with pytest.raises(StorageUnavailableError):
        await storage.put(KEY, b"x", content_type="image/jpeg")
    with pytest.raises(StorageUnavailableError):
        await storage.ping()


async def test_bucket_addressing() -> None:
    # Signing needs no network, so neither server has to exist.
    compatible = create_storage(s3_settings(NOWHERE, region="eu-central-1"))
    aws = create_storage(
        Settings(
            _env_file=None,
            storage_backend=StorageBackend.S3,
            s3_region="us-west-2",
            s3_bucket="media",
            s3_access_key="key",
            s3_secret_key=SecretStr("secret"),
        )
    )

    # Compatible servers: the bucket in the path. AWS: the bucket in the host name.
    assert (await compatible.download_url(KEY, expires_in=HOUR)).startswith(f"{NOWHERE}/test-")
    assert (await aws.download_url(KEY, expires_in=HOUR)).startswith(
        f"https://media.s3.amazonaws.com/{KEY}?"
    )


def test_credentials_come_in_pairs() -> None:
    with pytest.raises(ValidationError, match="or neither"):
        Settings(_env_file=None, s3_access_key="key")
    with pytest.raises(ValidationError, match="or neither"):
        Settings(_env_file=None, s3_secret_key=SecretStr("secret"))


async def test_the_app_uses_the_configured_bucket(s3_endpoint: str, settings: Settings) -> None:
    configured = s3_settings(s3_endpoint).model_copy(update={"database_url": settings.database_url})
    app = create_app(configured)
    assert isinstance(app.state.storage, S3Storage)
    transport = httpx2.ASGITransport(app=app)
    async with httpx2.AsyncClient(transport=transport, base_url="http://testserver") as client:
        missing = (await client.get("/readyz")).json()
        await app.state.storage.prepare(cors_origins=[])
        ready = (await client.get("/readyz")).json()
    await app.state.engine.dispose()

    assert missing == {"status": "unavailable", "database": "ok", "storage": "unreachable"}
    assert ready == {"status": "ready", "database": "ok", "storage": "ok"}


@pytest.mark.parametrize(("endpoint_works", "exit_code"), [(True, 0), (False, 1)])
def test_setup_command(
    s3_endpoint: str, monkeypatch: pytest.MonkeyPatch, endpoint_works: bool, exit_code: int
) -> None:
    settings = s3_settings(s3_endpoint)
    monkeypatch.setattr(setup_command, "get_settings", lambda: settings)
    if not endpoint_works:
        monkeypatch.setattr(setup_command, "create_storage", lambda _: unreachable_storage())
    # Leave the test run's logging alone.
    monkeypatch.setattr(setup_command, "configure_logging", lambda _: None)

    assert setup_command.main() == exit_code
    if endpoint_works:
        storage = create_storage(settings)
        assert isinstance(storage, S3Storage)
        client = create_client(settings)
        assert client.get_bucket_cors(Bucket=settings.s3_bucket)["CORSRules"]
