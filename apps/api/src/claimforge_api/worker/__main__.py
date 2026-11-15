"""Run the background worker.

    python -m claimforge_api.worker          # until SIGTERM / Ctrl+C
    python -m claimforge_api.worker --once   # process what's due, clean up, exit

Uses the same settings (``CLAIMFORGE_*``) as the API. Run as many as the photo volume
needs; they share the queue.
"""

import argparse
import asyncio
import contextlib
import logging
import signal
import sys

from claimforge_api.audit import recorder as audit_recorder
from claimforge_api.core.database import create_engine, create_session_factory
from claimforge_api.core.logging import configure_logging
from claimforge_api.core.settings import Settings, get_settings
from claimforge_api.storage.factory import create_storage
from claimforge_api.worker.runner import Worker

logger = logging.getLogger("claimforge_api.worker")


async def work(settings: Settings, *, once: bool) -> None:
    # Nothing the worker writes is audited today, but anything it ever writes should be.
    audit_recorder.install()
    engine = create_engine(settings)
    worker = Worker(
        sessions=create_session_factory(engine),
        storage=create_storage(settings),
        poll_interval=settings.worker_poll_seconds,
        cleanup_interval=settings.worker_cleanup_minutes * 60,
    )
    try:
        if once:
            processed, discarded = await worker.run_once()
            logger.info("Processed %d photos, discarded %d abandoned uploads", processed, discarded)
            return
        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            # Not on Windows: there, Ctrl+C arrives as KeyboardInterrupt instead.
            with contextlib.suppress(NotImplementedError):
                loop.add_signal_handler(sig, stop.set)
        await worker.run(stop)
    finally:
        await engine.dispose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--once", action="store_true", help="process what's due, then exit")
    args = parser.parse_args(argv)
    settings = get_settings()
    configure_logging(settings)
    with contextlib.suppress(KeyboardInterrupt):
        asyncio.run(work(settings, once=args.once))
    return 0


if __name__ == "__main__":
    sys.exit(main())
