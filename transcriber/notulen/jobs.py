"""Coordinator: recording sessions per room and the transcription queue.

One process, one asyncio loop. Recording is cheap (decoding Opus for a few speakers);
transcription is CPU heavy and runs in ``concurrency`` background threads (default 1)
so the LiveKit server on the same machine keeps its headroom.

Session states (also posted to the app): recording → transcribing → ready | failed.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import re
import uuid
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

from .appclient import AppClient
from .config import Settings
from .pipeline import transcribe_session
from .spool import Spool
from .transcribe import Transcriber

log = logging.getLogger(__name__)

ROOM_PATTERN = re.compile(r"^rk-[0-9a-hjkmnp-tv-z]{26}-\d{8}$")


class Recorder(Protocol):
    async def start(self) -> None: ...

    async def stop(self) -> None: ...

    def manifest_speakers(self) -> dict[str, Any]: ...


RecorderFactory = Callable[[Settings, str, str, Path, Iterable[str], Callable[[str], None]], Recorder]


@dataclass
class Session:
    room: str
    id: str
    directory: Path
    started_at: str
    recorder: Recorder | None = None
    state: str = "joining"
    ended: asyncio.Event = field(default_factory=asyncio.Event)


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class Coordinator:
    def __init__(
        self,
        settings: Settings,
        transcriber: Transcriber,
        app: AppClient,
        recorder_factory: RecorderFactory,
    ) -> None:
        self.settings = settings
        self.transcriber = transcriber
        self.app = app
        self.recorder_factory = recorder_factory
        self.spool = Spool(settings.spool_dir)
        self.sessions: dict[str, Session] = {}
        self.queue: asyncio.Queue[Path] = asyncio.Queue()
        self.busy = 0
        self._tasks: set[asyncio.Task[Any]] = set()
        self._workers: list[asyncio.Task[None]] = []

    # -- lifecycle -------------------------------------------------------------

    async def start(self) -> None:
        self.settings.spool_dir.mkdir(parents=True, exist_ok=True)
        self.recover()
        self._workers = [asyncio.create_task(self._worker()) for _ in range(self.settings.concurrency)]
        self._spawn(self._housekeeping())
        load = getattr(self.transcriber, "load", None)
        if callable(load):
            # Download/load the model in the background; the API answers meanwhile.
            self._spawn(asyncio.to_thread(load))

    async def close(self) -> None:
        for session in list(self.sessions.values()):
            if session.recorder is not None:
                with contextlib.suppress(Exception):
                    await session.recorder.stop()
        for task in [*self._workers, *self._tasks]:
            task.cancel()
        await self.app.close()

    def recover(self) -> None:
        """After a restart: forget old leftovers, finish what was interrupted."""
        for directory in self.spool.purge_older_than(self.settings.spool_max_age_hours):
            log.info("purged stale spool %s", directory.name)
        for directory in self.spool.sessions():
            if (directory / "result.json").is_file() or (directory / "manifest.json").is_file():
                self.queue.put_nowait(directory)
            else:
                self.spool.remove(directory)

    def health(self) -> dict[str, Any]:
        return {
            "status": "ok",
            "recording": sum(1 for s in self.sessions.values() if s.state == "recording"),
            "queued": self.queue.qsize(),
            "transcribing": self.busy,
            "model": self.transcriber.name,
        }

    # -- API -------------------------------------------------------------------

    @staticmethod
    def valid_room(room: str) -> bool:
        return ROOM_PATTERN.fullmatch(room) is not None

    async def join(self, room: str, token: str, excluded: Iterable[str] = ()) -> str:
        current = self.sessions.get(room)
        if current is not None and current.state in ("joining", "recording"):
            return "already"
        session_id = uuid.uuid4().hex
        session = Session(
            room=room,
            id=session_id,
            directory=self.spool.session_dir(room, session_id),
            started_at=utc_now(),
        )
        self.sessions[room] = session
        recorder = self.recorder_factory(
            self.settings, room, token, session.directory, list(excluded), lambda reason: self._ended(room, reason)
        )
        session.recorder = recorder
        self._write_manifest(session, {}, "recording")
        try:
            await recorder.start()
        except Exception as error:
            log.error("could not join %s: %s", room, type(error).__name__)
            self.sessions.pop(room, None)
            self.spool.remove(session.directory)
            raise
        session.state = "recording"
        self._spawn(self.app.post(self._status(session, "recording"), attempts=2))
        return "joining"

    async def finish(self, room: str, reason: str = "app") -> str:
        session = self.sessions.get(room)
        if session is None or session.state not in ("joining", "recording"):
            return "unknown"
        session.state = "finishing"
        log.info("finishing %s (%s)", room, reason)
        recorder = session.recorder
        speakers: dict[str, Any] = {}
        if recorder is not None:
            await recorder.stop()
            speakers = recorder.manifest_speakers()
        self.sessions.pop(room, None)
        self._write_manifest(session, speakers, "recorded")
        await self.queue.put(session.directory)
        return "finishing"

    def _ended(self, room: str, reason: str) -> None:
        self._spawn(self.finish(room, reason))

    # -- transcription ---------------------------------------------------------

    async def _worker(self) -> None:
        while True:
            directory = await self.queue.get()
            self.busy += 1
            try:
                await self.process(directory)
            except Exception:
                log.exception("processing %s failed", directory.name)
            finally:
                self.busy -= 1
                self.queue.task_done()

    async def process(self, directory: Path) -> None:
        """Transcribe (unless already done), delete the audio, post, clean up."""
        result_path = directory / "result.json"
        result = self.spool.read_json(result_path)
        if result is None:
            manifest = self.spool.read_json(directory / "manifest.json") or {}
            base = {
                "room": manifest.get("room"),
                "session": manifest.get("session"),
                "started_at": manifest.get("started_at"),
                "ended_at": manifest.get("ended_at") or utc_now(),
            }
            if not base["room"]:
                self.spool.remove(directory)
                return
            await self.app.post({**base, "status": "transcribing"}, attempts=2)
            try:
                transcript = await asyncio.to_thread(transcribe_session, directory, manifest, self.transcriber)
                result = {
                    **base,
                    "status": "ready",
                    "language": self.settings.language,
                    "model": f"faster-whisper/{self.transcriber.name}",
                    **transcript,
                }
            except Exception as error:
                log.exception("transcription failed for %s", base["room"])
                result = {**base, "status": "failed", "error": f"Transkripsi gagal ({type(error).__name__})."}
            self.spool.write_json(result_path, result)
        # Privacy: audio never outlives its transcription.
        self.spool.delete_audio(directory)
        if await self.app.post(result):
            self.spool.remove(directory)
        else:
            log.error("transcript for %s not delivered; kept until the spool purge", result.get("room"))

    # -- helpers ---------------------------------------------------------------

    def _status(self, session: Session, status: str) -> dict[str, Any]:
        return {"room": session.room, "session": session.id, "started_at": session.started_at, "status": status}

    def _write_manifest(self, session: Session, speakers: dict[str, Any], state: str) -> None:
        data = {
            "room": session.room,
            "session": session.id,
            "started_at": session.started_at,
            "state": state,
            "speakers": speakers,
        }
        if state == "recorded":
            data["ended_at"] = utc_now()
        self.spool.write_json(session.directory / "manifest.json", data)

    def _spawn(self, coroutine: Any) -> None:
        task = asyncio.create_task(coroutine)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _housekeeping(self) -> None:
        while True:
            await asyncio.sleep(3600)
            # Active recordings keep touching their files, so only leftovers age out.
            self.spool.purge_older_than(self.settings.spool_max_age_hours)
