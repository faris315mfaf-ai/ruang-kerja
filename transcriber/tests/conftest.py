from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path
from typing import ClassVar

import pytest

from notulen.config import Settings
from notulen.jobs import Coordinator
from notulen.spool import SAMPLE_RATE, SpeakerTrack
from notulen.transcribe import Recognized

SECRET = "t" * 40
CALLBACK_SECRET = "c" * 40
ROOM = "rk-01hzx3k9q2w8e7r6t5y4v3m2n1-20261007"


class FakeTranscriber:
    """Stands in for faster-whisper (no model download in tests/CI)."""

    name = "fake"

    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.files: list[str] = []

    def transcribe(self, path: Path) -> list[Recognized]:
        if self.fail:
            raise RuntimeError("model missing")
        self.files.append(path.name)
        return [Recognized(0.1, 0.9, f"teks {path.name}", 0.0)]


class FakeApp:
    def __init__(self, accept: bool = True) -> None:
        self.accept = accept
        self.posts: list[dict] = []

    async def post(self, payload: dict, attempts: int = 6) -> bool:
        self.posts.append(json.loads(json.dumps(payload)))
        return self.accept

    async def close(self) -> None:
        pass


class FakeRecorder:
    """Writes a little audio for two speakers instead of joining LiveKit."""

    instances: ClassVar[list[FakeRecorder]] = []

    def __init__(self, settings, room, token, directory, excluded, on_ended) -> None:
        self.room, self.token, self.directory = room, token, directory
        self.excluded = list(excluded)
        self.on_ended = on_ended
        self.started = self.stopped = False
        self.speakers: dict[str, SpeakerTrack] = {}
        FakeRecorder.instances.append(self)

    async def start(self) -> None:
        self.started = True
        for index, (identity, name, at) in enumerate([("01HZA", "Rina", 1000), ("01HZB", "Budi", 3000)], 1):
            if identity in self.excluded:
                continue
            track = SpeakerTrack(self.directory, index, identity, name)
            track.write(at, b"\x00\x00" * SAMPLE_RATE)
            self.speakers[identity] = track

    async def stop(self) -> None:
        self.stopped = True
        for track in self.speakers.values():
            track.close()

    def set_excluded(self, identity: str, excluded: bool) -> None:
        if excluded:
            track = self.speakers.pop(identity, None)
            if track is not None:
                track.drop()

    def manifest_speakers(self) -> dict:
        return {identity: t.to_manifest() for identity, t in self.speakers.items()}


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return replace(
        Settings(
            secret=SECRET,
            callback_secret=CALLBACK_SECRET,
            app_url="https://app.test",
            livekit_url="ws://127.0.0.1:7880",
        ),
        spool_dir=tmp_path / "spool",
    )


@pytest.fixture
def fakes():
    FakeRecorder.instances = []
    return FakeTranscriber(), FakeApp()


@pytest.fixture
def coordinator(settings, fakes) -> Coordinator:
    transcriber, app = fakes
    return Coordinator(settings, transcriber, app, FakeRecorder)
