"""Speech recognition backends.

Stage 1 (now): faster-whisper on CPU (CTranslate2, int8), model ``large-v3-turbo`` by
default; ``small``/``medium`` trade accuracy for speed. Stage 2 (GPU, later) can add
another ``Transcriber`` (e.g. Qwen3-ASR via vLLM, streaming) without touching the
recorder or the pipeline.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import NamedTuple, Protocol

from .config import Settings


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
                self.settings.model,
                device="cpu",
                compute_type=self.settings.compute_type,
                cpu_threads=self.settings.cpu_threads,
                num_workers=self.settings.concurrency,
                download_root=str(self.settings.model_dir) if self.settings.model_dir else None,
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
