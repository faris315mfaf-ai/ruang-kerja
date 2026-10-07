"""After the meeting: recognize every spooled file and build the transcript."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from .merge import Piece, is_noise, merge
from .transcribe import Transcriber

log = logging.getLogger(__name__)


def transcribe_session(directory: Path, manifest: dict[str, Any], transcriber: Transcriber) -> dict[str, Any]:
    """Transcript payload (without room/status) for a recorded session.

    Each file's recognized pieces are shifted by the file's wall-clock offset, noise is
    dropped, and all speakers are merged by time.
    """
    pieces: list[Piece] = []
    audio_ms = 0
    speakers = manifest.get("speakers") or {}
    for identity, speaker in speakers.items():
        name = str(speaker.get("name") or "")
        for segment in speaker.get("segments") or []:
            path = directory / str(segment["file"])
            if not path.is_file():
                continue
            offset = int(segment["start_ms"])
            audio_ms += int(segment.get("samples", 0)) * 1000 // 16_000
            for item in transcriber.transcribe(path):
                start = offset + int(item.start * 1000)
                end = offset + int(item.end * 1000)
                if is_noise(item.text, end - start, item.no_speech_prob):
                    continue
                pieces.append(Piece(identity, name, start, end, item.text))
    segments = merge(pieces)
    duration_ms = max((int(s["end_ms"]) for s in segments), default=0)
    log.info("transcribed %d speakers, %d s audio, %d segments", len(speakers), audio_ms // 1000, len(segments))
    return {
        "segments": segments,
        "duration_ms": duration_ms,
        "audio_ms": audio_ms,
        "speakers": len(speakers),
    }
