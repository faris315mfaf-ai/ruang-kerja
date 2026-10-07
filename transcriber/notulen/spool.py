"""Local audio spool: one folder per room session, one WAV series per speaker.

    {spool}/{room}/{session}/manifest.json   who spoke, files and wall-clock offsets
    {spool}/{room}/{session}/s001-0001.wav   16 kHz mono 16-bit PCM
    {spool}/{room}/{session}/result.json     transcript waiting to be posted

Offsets are milliseconds since the session started (``started_at`` in the manifest).
A speaker's audio is split into a new file after a gap (muted, left, network) or after
``max_segment_ms`` so transcription memory stays bounded. File names never contain
identities. Audio is deleted right after transcription; whatever is left behind is
removed after ``spool_max_age_hours``.
"""

from __future__ import annotations

import json
import os
import shutil
import time
import wave
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

SAMPLE_RATE = 16_000
SAMPLE_WIDTH = 2  # bytes, signed 16-bit


@dataclass
class SegmentFile:
    file: str
    start_ms: int
    samples: int = 0

    @property
    def duration_ms(self) -> int:
        return self.samples * 1000 // SAMPLE_RATE

    @property
    def end_ms(self) -> int:
        return self.start_ms + self.duration_ms


@dataclass
class SpeakerTrack:
    """Writes one speaker's PCM into consecutive WAV files."""

    directory: Path
    index: int
    identity: str
    name: str
    gap_ms: int = 2_000
    max_segment_ms: int = 600_000
    segments: list[SegmentFile] = field(default_factory=list)
    _wave: Any = None

    @property
    def current(self) -> SegmentFile | None:
        return self.segments[-1] if self.segments and self._wave is not None else None

    def write(self, received_ms: int, pcm: bytes) -> None:
        """Append one frame that arrived ``received_ms`` after the session start."""
        samples = len(pcm) // SAMPLE_WIDTH
        if samples == 0:
            return
        frame_start = max(0, received_ms - samples * 1000 // SAMPLE_RATE)
        current = self.current
        if current is None or frame_start - current.end_ms > self.gap_ms:
            self._open(frame_start)
        elif current.duration_ms >= self.max_segment_ms:
            self._open(current.end_ms)
        segment = self.segments[-1]
        self._wave.writeframes(pcm[: samples * SAMPLE_WIDTH])
        segment.samples += samples

    def close(self) -> None:
        if self._wave is not None:
            self._wave.close()
            self._wave = None
        # Files without audio are useless.
        kept = []
        for segment in self.segments:
            if segment.samples > 0:
                kept.append(segment)
            else:
                (self.directory / segment.file).unlink(missing_ok=True)
        self.segments = kept

    def drop(self) -> None:
        """Opt-out during the meeting: forget everything recorded for this person."""
        self.close()
        for segment in self.segments:
            (self.directory / segment.file).unlink(missing_ok=True)
        self.segments = []

    def to_manifest(self) -> dict[str, Any]:
        return {"name": self.name, "segments": [asdict(s) for s in self.segments]}

    def _open(self, start_ms: int) -> None:
        if self._wave is not None:
            self._wave.close()
        name = f"s{self.index:03d}-{len(self.segments) + 1:04d}.wav"
        handle = wave.open(str(self.directory / name), "wb")  # noqa: SIM115 - closed in close()
        handle.setnchannels(1)
        handle.setsampwidth(SAMPLE_WIDTH)
        handle.setframerate(SAMPLE_RATE)
        self._wave = handle
        self.segments.append(SegmentFile(file=name, start_ms=start_ms))


class Spool:
    def __init__(self, root: Path) -> None:
        self.root = root

    def session_dir(self, room: str, session: str) -> Path:
        path = self.root / room / session
        path.mkdir(parents=True, exist_ok=True)
        os.chmod(path, 0o700)
        return path

    @staticmethod
    def write_json(path: Path, data: dict[str, Any]) -> None:
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)

    @staticmethod
    def read_json(path: Path) -> dict[str, Any] | None:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None
        return data if isinstance(data, dict) else None

    @staticmethod
    def delete_audio(directory: Path) -> int:
        removed = 0
        for path in directory.glob("*.wav"):
            path.unlink(missing_ok=True)
            removed += 1
        return removed

    def remove(self, directory: Path) -> None:
        shutil.rmtree(directory, ignore_errors=True)
        parent = directory.parent
        if parent != self.root and parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()

    def usage_bytes(self) -> int:
        if not self.root.is_dir():
            return 0
        return sum(p.stat().st_size for p in self.root.rglob("*") if p.is_file())

    def remove_temp_files(self) -> int:
        removed = 0
        for path in self.root.rglob("*.tmp"):
            path.unlink(missing_ok=True)
            removed += 1
        return removed

    def sessions(self) -> list[Path]:
        """Session folders on disk (room/session), oldest first."""
        if not self.root.is_dir():
            return []
        found = [p for p in self.root.glob("*/*") if p.is_dir()]
        return sorted(found, key=lambda p: p.stat().st_mtime)

    def purge_older_than(self, hours: int, now: float | None = None) -> list[Path]:
        """Delete sessions untouched for ``hours`` (privacy: nothing lingers)."""
        limit = (now if now is not None else time.time()) - hours * 3600
        removed = []
        for directory in self.sessions():
            newest = max([directory.stat().st_mtime] + [p.stat().st_mtime for p in directory.iterdir()])
            if newest < limit:
                self.remove(directory)
                removed.append(directory)
        return removed
