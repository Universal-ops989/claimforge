"""Objects in an S3 bucket: AWS, or a compatible server such as SeaweedFS, MinIO or R2.

Signed URLs are S3 presigned URLs, so uploads and downloads go to the bucket directly.
boto3 is synchronous; its calls run in worker threads (a client is safe to share across
threads).
"""

import asyncio
import logging
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from claimforge_api.core.settings import Settings
from claimforge_api.storage.base import (
    ObjectInfo,
    ObjectNotFoundError,
    SignedUpload,
    StorageUnavailableError,
    check_content_type,
    check_key,
    check_lifetime,
    content_disposition,
)

if TYPE_CHECKING:
    from types_boto3_s3.client import S3Client

logger = logging.getLogger(__name__)

DEFAULT_CONTENT_TYPE = "application/octet-stream"
#: Error codes for a missing object. (HEAD responses have no body, so only "404".)
_NO_OBJECT = frozenset({"404", "NoSuchKey", "NotFound"})


def _code(error: ClientError) -> str:
    return str(error.response.get("Error", {}).get("Code", ""))


def create_client(settings: Settings) -> "S3Client":
    """An S3 client for ``settings``. Opens no connection until the first call."""
    secret = settings.s3_secret_key.get_secret_value() if settings.s3_secret_key else None
    config = Config(
        signature_version="s3v4",
        # Compatible servers rarely have wildcard DNS for virtual-host buckets.
        s3={"addressing_style": "path" if settings.s3_endpoint_url else "auto"},
        retries={"mode": "standard", "max_attempts": 3},
        connect_timeout=5,
        read_timeout=60,
    )
    # A session per client: boto3's default session isn't safe to share across threads.
    return boto3.session.Session().client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=secret,
        config=config,
    )


class S3Storage:
    def __init__(self, client: "S3Client", bucket: str) -> None:
        self._client = client
        self._bucket = bucket

    async def _run[T](self, call: Callable[..., T], /, *args: Any, **kwargs: Any) -> T:
        """``call`` in a worker thread, with S3's errors turned into the interface's."""
        try:
            return await asyncio.to_thread(call, *args, **kwargs)
        except ClientError as error:
            if _code(error) in _NO_OBJECT:
                raise ObjectNotFoundError(kwargs.get("Key", "")) from None
            raise StorageUnavailableError(f"Bucket {self._bucket!r}: {error}") from error
        except BotoCoreError as error:  # network, credentials, timeouts
            raise StorageUnavailableError(f"Bucket {self._bucket!r}: {error}") from error

    async def put(self, key: str, data: bytes, *, content_type: str) -> ObjectInfo:
        key, content_type = check_key(key), check_content_type(content_type)
        await self._run(
            self._client.put_object,
            Bucket=self._bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return ObjectInfo(key=key, size=len(data), content_type=content_type)

    async def get(self, key: str) -> bytes:
        key = check_key(key)

        def download() -> bytes:
            # Reading the body is network I/O too, so it happens in the same thread.
            with self._client.get_object(Bucket=self._bucket, Key=key)["Body"] as body:
                return body.read()

        try:
            return await self._run(download)
        except ObjectNotFoundError:
            raise ObjectNotFoundError(key) from None

    async def stat(self, key: str) -> ObjectInfo | None:
        key = check_key(key)
        try:
            head = await self._run(self._client.head_object, Bucket=self._bucket, Key=key)
        except ObjectNotFoundError:
            return None
        return ObjectInfo(
            key=key,
            size=head["ContentLength"],
            content_type=head.get("ContentType") or DEFAULT_CONTENT_TYPE,
        )

    async def delete(self, key: str) -> None:
        # S3 deletes are idempotent: a missing key is not an error.
        await self._run(self._client.delete_object, Bucket=self._bucket, Key=check_key(key))

    async def upload_url(
        self, key: str, *, content_type: str, expires_in: timedelta
    ) -> SignedUpload:
        key, content_type = check_key(key), check_content_type(content_type)
        seconds = int(check_lifetime(expires_in).total_seconds())
        expires_at = datetime.now(UTC) + timedelta(seconds=seconds)
        # Signing can fetch credentials (instance roles), so it runs off the event loop too.
        url = await self._run(
            self._client.generate_presigned_url,
            "put_object",
            Params={"Bucket": self._bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=seconds,
        )
        return SignedUpload(
            url=url, method="PUT", headers={"Content-Type": content_type}, expires_at=expires_at
        )

    async def download_url(
        self, key: str, *, expires_in: timedelta, filename: str | None = None
    ) -> str:
        params = {"Bucket": self._bucket, "Key": check_key(key)}
        if filename:
            params["ResponseContentDisposition"] = content_disposition(filename)
        return await self._run(
            self._client.generate_presigned_url,
            "get_object",
            Params=params,
            ExpiresIn=int(check_lifetime(expires_in).total_seconds()),
        )

    async def ping(self) -> None:
        try:
            await self._run(self._client.head_bucket, Bucket=self._bucket)
        except ObjectNotFoundError:
            raise StorageUnavailableError(f"Bucket {self._bucket!r} does not exist") from None

    async def prepare(self, *, cors_origins: list[str]) -> None:
        await self._run(self._create_bucket)
        await self._run(self._allow_browsers, cors_origins)

    def _create_bucket(self) -> None:
        try:
            self._client.head_bucket(Bucket=self._bucket)
            return
        except ClientError as error:
            if _code(error) not in _NO_OBJECT:
                raise
        region = self._client.meta.region_name
        if region == "us-east-1":  # the one region that refuses a location constraint
            self._client.create_bucket(Bucket=self._bucket)
        else:
            self._client.create_bucket(
                Bucket=self._bucket,
                CreateBucketConfiguration={"LocationConstraint": region},  # type: ignore[typeddict-item]
            )
        logger.info("Created bucket %s", self._bucket)

    def _allow_browsers(self, origins: list[str]) -> None:
        """Let the web apps PUT uploads and GET downloads with presigned URLs."""
        if not origins:
            return
        try:
            self._client.put_bucket_cors(
                Bucket=self._bucket,
                CORSConfiguration={
                    "CORSRules": [
                        {
                            "AllowedOrigins": origins,
                            "AllowedMethods": ["GET", "HEAD", "PUT"],
                            "AllowedHeaders": ["Content-Type"],
                            "ExposeHeaders": ["ETag"],
                            "MaxAgeSeconds": 3600,
                        }
                    ]
                },
            )
        except ClientError as error:
            if _code(error) != "NotImplemented":
                raise
            logger.warning(
                "This S3 server doesn't support bucket CORS; configure it on the server "
                "so browsers can upload to %s",
                self._bucket,
            )
