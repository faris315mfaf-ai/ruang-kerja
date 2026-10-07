"""Settings from environment variables (never logged: the secret is masked)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _int(name: str, default: int, minimum: int = 0) -> int:
    raw = os.environ.get(name, "").strip()
    try:
        value = int(raw) if raw else default
    except ValueError:
        value = default
    return max(minimum, value)


@dataclass(frozen=True)
class Settings:
    # Shared HMAC secret with the app (TRANSCRIBER_SECRET on both sides, >= 32 chars).
    secret: str
    # Base URL of the app, e.g. https://spkd.store (transcripts go to /api/notulen/transcript).
    app_url: str
    # LiveKit signalling URL as seen from this worker (ws://127.0.0.1:7880 next to LiveKit).
    livekit_url: str
    host: str = "0.0.0.0"  # noqa: S104 - container port, published only to localhost/Caddy
    port: int = 8090
    spool_dir: Path = field(default_factory=lambda: Path("/var/spool/notulen"))
    # faster-whisper: model name or path, int8 on CPU; threads per transcription.
    model: str = "large-v3-turbo"
    compute_type: str = "int8"
    cpu_threads: int = 4
    beam_size: int = 1
    language: str = "id"
    model_dir: Path | None = None
    # Transcriptions running at the same time (1 keeps the meeting server responsive).
    concurrency: int = 1
    # Signed requests older/newer than this many seconds are refused (replay window).
    tolerance_seconds: int = 300
    # Leave the room when no human has been in it for this long.
    empty_grace_seconds: int = 90
    # Safety cap for one recording session.
    max_recording_minutes: int = 240
    # A spool file is cut after this many seconds of audio (bounds memory while transcribing).
    max_segment_seconds: int = 600
    # Audio/transcripts left behind (crash, app unreachable) are deleted after this many hours.
    spool_max_age_hours: int = 24
    identity: str = "rk-notulen"
    # Extra CA certificate to trust for the app URL (local dev: the Herd CA). Empty = system CAs.
    ca_file: Path | None = None

    @classmethod
    def from_env(cls) -> Settings:
        model_dir = os.environ.get("WHISPER_MODEL_DIR", "").strip()
        ca_file = os.environ.get("TRANSCRIBER_CA_FILE", "").strip()
        return cls(
            secret=os.environ.get("TRANSCRIBER_SECRET", ""),
            app_url=os.environ.get("TRANSCRIBER_APP_URL", "").rstrip("/"),
            livekit_url=os.environ.get("LIVEKIT_URL", "ws://127.0.0.1:7880").rstrip("/"),
            host=os.environ.get("TRANSCRIBER_HOST", "0.0.0.0"),  # noqa: S104
            port=_int("TRANSCRIBER_PORT", 8090, 1),
            spool_dir=Path(os.environ.get("TRANSCRIBER_SPOOL_DIR", "/var/spool/notulen")),
            model=os.environ.get("WHISPER_MODEL", "large-v3-turbo"),
            compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
            cpu_threads=_int("WHISPER_CPU_THREADS", 4, 1),
            beam_size=_int("WHISPER_BEAM_SIZE", 1, 1),
            language=os.environ.get("WHISPER_LANGUAGE", "id"),
            model_dir=Path(model_dir) if model_dir else None,
            concurrency=_int("TRANSCRIBE_CONCURRENCY", 1, 1),
            tolerance_seconds=_int("TRANSCRIBER_TOLERANCE", 300, 30),
            empty_grace_seconds=_int("TRANSCRIBER_EMPTY_GRACE", 90, 10),
            max_recording_minutes=_int("TRANSCRIBER_MAX_MINUTES", 240, 5),
            max_segment_seconds=_int("TRANSCRIBER_MAX_SEGMENT_SECONDS", 600, 30),
            spool_max_age_hours=_int("TRANSCRIBER_SPOOL_MAX_AGE_HOURS", 24, 1),
            ca_file=Path(ca_file) if ca_file else None,
        )

    def problems(self) -> list[str]:
        """Configuration errors that stop the worker from starting."""
        issues = []
        if len(self.secret) < 32:
            issues.append("TRANSCRIBER_SECRET must be at least 32 characters")
        if not self.app_url.startswith(("https://", "http://")):
            issues.append("TRANSCRIBER_APP_URL must be the app base URL (https://...)")
        if not self.livekit_url.startswith(("ws://", "wss://")):
            issues.append("LIVEKIT_URL must start with ws:// or wss://")
        return issues

    def __repr__(self) -> str:  # never print the secret
        return f"Settings(app_url={self.app_url!r}, livekit_url={self.livekit_url!r}, model={self.model!r})"
