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


def _float(name: str, default: float, minimum: float) -> float:
    raw = os.environ.get(name, "").strip()
    try:
        value = float(raw) if raw else default
    except ValueError:
        value = default
    return max(minimum, value)


@dataclass(frozen=True)
class Settings:
    # HMAC secret of app → worker requests (TRANSCRIBER_SECRET on both sides, >= 32 chars).
    secret: str
    # Base URL of the app, e.g. https://spkd.store (transcripts go to /api/notulen/transcript).
    app_url: str
    # LiveKit signalling URL as seen from this worker (ws://127.0.0.1:7880 next to LiveKit).
    livekit_url: str
    # HMAC secret of worker → app callbacks (TRANSCRIBER_CALLBACK_SECRET), different from `secret`.
    callback_secret: str = ""
    # Localhost by default; Caddy (or a private interface) publishes the API.
    host: str = "127.0.0.1"
    port: int = 8090
    spool_dir: Path = field(default_factory=lambda: Path("/var/spool/notulen"))
    # faster-whisper: model name or path, int8 on CPU; threads per transcription.
    model: str = "large-v3-turbo"
    # Hugging Face commit and model.bin SHA-256 (built-in pins for large-v3-turbo and small).
    model_revision: str = ""
    model_sha256: str = ""
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
    # Disk cap of the audio spool: no new recordings and running ones stop (ALERT) beyond it.
    spool_max_gb: float = 20.0
    identity: str = "rk-notulen"
    # Extra CA certificate to trust for the app URL (local dev: the Herd CA). Empty = system CAs.
    ca_file: Path | None = None

    @classmethod
    def from_env(cls) -> Settings:
        model_dir = os.environ.get("WHISPER_MODEL_DIR", "").strip()
        ca_file = os.environ.get("TRANSCRIBER_CA_FILE", "").strip()
        return cls(
            secret=os.environ.get("TRANSCRIBER_SECRET", ""),
            callback_secret=os.environ.get("TRANSCRIBER_CALLBACK_SECRET", ""),
            app_url=os.environ.get("TRANSCRIBER_APP_URL", "").rstrip("/"),
            livekit_url=os.environ.get("LIVEKIT_URL", "ws://127.0.0.1:7880").rstrip("/"),
            host=os.environ.get("TRANSCRIBER_HOST", "127.0.0.1"),
            port=_int("TRANSCRIBER_PORT", 8090, 1),
            spool_dir=Path(os.environ.get("TRANSCRIBER_SPOOL_DIR", "/var/spool/notulen")),
            model=os.environ.get("WHISPER_MODEL", "large-v3-turbo"),
            model_revision=os.environ.get("WHISPER_MODEL_REVISION", "").strip(),
            model_sha256=os.environ.get("WHISPER_MODEL_SHA256", "").strip().lower(),
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
            spool_max_gb=_float("TRANSCRIBER_SPOOL_MAX_GB", 20.0, 0.1),
            ca_file=Path(ca_file) if ca_file else None,
        )

    def problems(self) -> list[str]:
        """Configuration errors that stop the worker from starting."""
        issues = []
        if len(self.secret) < 32:
            issues.append("TRANSCRIBER_SECRET must be at least 32 characters")
        if len(self.callback_secret) < 32:
            issues.append("TRANSCRIBER_CALLBACK_SECRET must be at least 32 characters")
        if self.secret and self.secret == self.callback_secret:
            issues.append("TRANSCRIBER_CALLBACK_SECRET must differ from TRANSCRIBER_SECRET")
        if not self.app_url.startswith(("https://", "http://")):
            issues.append("TRANSCRIBER_APP_URL must be the app base URL (https://...)")
        if not self.livekit_url.startswith(("ws://", "wss://")):
            issues.append("LIVEKIT_URL must start with ws:// or wss://")
        return issues

    def __repr__(self) -> str:  # never print the secret
        return f"Settings(app_url={self.app_url!r}, livekit_url={self.livekit_url!r}, model={self.model!r})"
