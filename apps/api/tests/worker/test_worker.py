"""The background worker: draining the queue, cleaning up, stopping, and riding out outages."""

import asyncio
import io
import logging
from collections.abc import AsyncIterator
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from datetime import UTC, datetime, timedelta

import pytest
from PIL import Image
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession
from tests.photos.conftest import Site

from claimforge_api.core.settings import Settings
from claimforge_api.photos.models import PhotoProcessing, PhotoUpload, ProcessingStatus
from claimforge_api.worker import __main__ as command
from claimforge_api.worker.runner import Worker


def jpeg() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (640, 480), "teal").save(out, format="JPEG")
    return out.getvalue()


class SessionsFor:
    """A session factory handing out the test's own (rolled-back) session."""

    def __init__(self, session: AsyncSession) -> None:
        self.session, self.failures = session, 0

    def __call__(self) -> AbstractAsyncContextManager[AsyncSession]:
        @asynccontextmanager
        async def open_session() -> AsyncIterator[AsyncSession]:
            if self.failures:
                self.failures -= 1
                raise OperationalError("SELECT 1", {}, ConnectionRefusedError("db down"))
            yield self.session

        return open_session()


async def statuses(session: AsyncSession) -> list[str]:
    return list(await session.scalars(select(PhotoProcessing.status)))


async def abandon(site: Site) -> PhotoUpload:
    upload = await site.start()
    upload.expires_at = datetime.now(UTC) - timedelta(days=1)
    await site.session.commit()
    return upload


async def test_drain_processes_everything_due(site: Site) -> None:
    for _ in range(3):
        await site.photo(jpeg())
    worker = Worker(sessions=SessionsFor(site.session), storage=site.storage)

    assert await worker.drain() == 3
    assert await worker.drain() == 0
    assert await statuses(site.session) == ["ready"] * 3


async def test_a_stop_request_waits_for_the_photo_in_hand(site: Site) -> None:
    for _ in range(3):
        await site.photo(jpeg())
    stop = asyncio.Event()
    factory = SessionsFor(site.session)

    def stop_while_processing() -> AbstractAsyncContextManager[AsyncSession]:
        stop.set()  # asked to stop while the first photo is being processed
        return factory()

    worker = Worker(sessions=stop_while_processing, storage=site.storage)

    assert await worker.drain(stop) == 1
    assert sorted(await statuses(site.session)) == ["pending", "pending", "ready"]


async def test_cleanup_runs_on_its_interval(site: Site) -> None:
    now = [1000.0]
    worker = Worker(
        sessions=SessionsFor(site.session),
        storage=site.storage,
        cleanup_interval=15 * 60,
        clock=lambda: now[0],
    )
    await abandon(site)

    assert await worker.clean_up() == 1  # the first run cleans at once
    await abandon(site)
    now[0] += 60
    assert await worker.clean_up() == 0  # not due yet
    now[0] += 15 * 60
    assert await worker.clean_up() == 1
    await abandon(site)
    assert await worker.clean_up(force=True) == 1


class Recording(Worker):
    """Stops itself after ``rounds`` drains, remembering what each one did."""

    def __init__(self, *args: object, rounds: int, stop: asyncio.Event, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]
        self.rounds, self.stop, self.drained = rounds, stop, list[int]()

    async def drain(self, stop: asyncio.Event | None = None) -> int:
        processed = await super().drain(stop)
        self.drained.append(processed)
        if len(self.drained) >= self.rounds:
            self.stop.set()
        return processed


async def test_runs_until_asked_to_stop(site: Site) -> None:
    await site.photo(jpeg())
    stop = asyncio.Event()
    worker = Recording(
        sessions=SessionsFor(site.session),
        storage=site.storage,
        poll_interval=0.01,
        rounds=3,
        stop=stop,
    )

    await asyncio.wait_for(worker.run(stop), timeout=5)

    assert worker.drained == [1, 0, 0]
    assert await statuses(site.session) == [ProcessingStatus.READY]


async def test_database_outages_are_waited_out(
    site: Site, caplog: pytest.LogCaptureFixture
) -> None:
    await site.photo(jpeg())
    stop = asyncio.Event()
    factory = SessionsFor(site.session)
    factory.failures = 2
    worker = Recording(
        sessions=factory, storage=site.storage, poll_interval=0.01, rounds=1, stop=stop
    )

    with caplog.at_level(logging.ERROR):
        await asyncio.wait_for(worker.run(stop), timeout=5)

    assert caplog.text.count("Worker iteration failed") == 2
    assert worker.drained == [1]
    assert await statuses(site.session) == ["ready"]


def test_once_from_the_command_line(
    settings: Settings, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(command, "get_settings", lambda: settings)
    # Leave the test run's logging alone.
    monkeypatch.setattr(command, "configure_logging", lambda _: None)

    with caplog.at_level(logging.INFO):
        assert command.main(["--once"]) == 0

    assert "Processed 0 photos, discarded 0 abandoned uploads" in caplog.text
