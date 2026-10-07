"""Speech recognition backends.

Stage 1 (now): faster-whisper on CPU (CTranslate2, int8), model ``large-v3-turbo`` by
default; ``small``/``medium`` trade accuracy for speed. Stage 2 (GPU, later) can add
another ``Transcriber`` (e.g. Qwen3-ASR via vLLM, streaming) without touching the
recorder or the pipeline.
"""

from __future__ import annotations

import hashlib
import logging
import threading
from collections.abc import Callable
from pathlib import Path
from typing import NamedTuple, Protocol

from .config import Settings

log = logging.getLogger(__name__)


class ModelPin(NamedTuple):
    repo: str
    revision: str  # Hugging Face commit
    sha256: str  # of model.bin


# Supply-chain pins: a model is only loaded at a known commit with a known checksum.
PINNED: dict[str, ModelPin] = {
    "large-v3-turbo": ModelPin(
        "mobiuslabsgmbh/faster-whisper-large-v3-turbo",
        "0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf",
        "e76620f83d5f5b69efd3d87e3dc180c1bd21df9fbebacfd4335e5e1efcc018da",
    ),
    "small": ModelPin(
        "Systran/faster-whisper-small",
        "536b0662742c02347bc0e980a01041f333bce120",
        "3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671",
    ),
}


class ModelError(RuntimeError):
    """The model is not pinned or does not match its checksum."""


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def resolve_model(settings: Settings, download: Callable[..., str] | None = None) -> Path:
    """Local folder of the model at a pinned revision, checksum verified.

    WHISPER_MODEL = a built-in name (``large-v3-turbo``, ``small``), a Hugging Face repo
    id (needs WHISPER_MODEL_REVISION, ideally WHISPER_MODEL_SHA256) or a local folder.
    """
    local = Path(settings.model)
    pin = PINNED.get(settings.model)
    if local.is_dir():
        path, expected = local, settings.model_sha256
    else:
        revision = settings.model_revision or (pin.revision if pin else "")
        if not revision:
            raise ModelError(f"model {settings.model!r} is not pinned: set WHISPER_MODEL_REVISION (and _SHA256)")
        # A custom revision of a built-in model needs its own checksum.
        expected = settings.model_sha256 or (pin.sha256 if pin and not settings.model_revision else "")
        if download is None:
            from faster_whisper.utils import download_model as download
        path = Path(
            download(
                pin.repo if pin else settings.model,
                cache_dir=str(settings.model_dir) if settings.model_dir else None,
                revision=revision,
            )
        )
    if expected:
        actual = file_sha256(path / "model.bin")
        if actual != expected:
            raise ModelError(f"model.bin checksum mismatch for {settings.model!r}")
    else:
        log.warning("model %s loaded without a checksum (set WHISPER_MODEL_SHA256)", settings.model)
    return path


class Recognized(NamedTuple):
    start: float  # seconds from the start of the file
    end: float
    text: str
    no_speech_prob: float = 0.0


class Transcriber(Protocol):
    name: str

    def transcribe(self, path: Path) -> list[Recognized]: ...


class FasterWhisperTranscriber:
    """Loads the model on first use (the HTTP API is up before the download finishes)."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.name = settings.model
        self._model = None
        self._lock = threading.Lock()

    def load(self) -> None:
        with self._lock:
            if self._model is not None:
                return
            from faster_whisper import WhisperModel  # heavy import, only in the worker

            self._model = WhisperModel(
                str(resolve_model(self.settings)),
                device="cpu",
                compute_type=self.settings.compute_type,
                cpu_threads=self.settings.cpu_threads,
                num_workers=self.settings.concurrency,
            )

    def transcribe(self, path: Path) -> list[Recognized]:
        self.load()
        assert self._model is not None
        segments, _info = self._model.transcribe(
            str(path),
            language=self.settings.language or None,
            task="transcribe",
            beam_size=self.settings.beam_size,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
            condition_on_previous_text=False,
            word_timestamps=False,
        )
        return [Recognized(s.start, s.end, s.text, float(s.no_speech_prob)) for s in segments]
