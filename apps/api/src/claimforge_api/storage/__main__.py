"""Prepare the configured storage backend, then check that it works.

    python -m claimforge_api.storage

Creates the bucket (S3) or directories (local) if they are missing, and lets the web apps'
origins (``CLAIMFORGE_CORS_ORIGINS``) upload with presigned URLs. Safe to run repeatedly:
run it once per environment, and again after changing the allowed origins.
"""

import asyncio
import logging
import sys

from claimforge_api.core.logging import configure_logging
from claimforge_api.core.settings import Settings, get_settings
from claimforge_api.storage.base import StorageUnavailableError
from claimforge_api.storage.factory import create_storage

logger = logging.getLogger("claimforge_api.storage")


async def prepare(settings: Settings) -> None:
    storage = create_storage(settings)
    await storage.prepare(cors_origins=settings.cors_origins)
    await storage.ping()


def main() -> int:
    settings = get_settings()
    configure_logging(settings)
    try:
        asyncio.run(prepare(settings))
    except StorageUnavailableError as error:
        logger.error("Storage is not usable: %s", error)
        return 1
    logger.info("Storage ready (%s backend)", settings.storage_backend.value)
    return 0


if __name__ == "__main__":
    sys.exit(main())
