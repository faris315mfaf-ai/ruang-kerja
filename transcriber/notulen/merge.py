"""Merge per-speaker recognition results into one transcript ordered by time.

Speaker attribution needs no diarization model: every LiveKit participant has their
own microphone track, so each piece already belongs to one identity.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import asdict, dataclass

# Phrases Whisper tends to invent on silence/noise (Indonesian + common English).
HALLUCINATIONS = {
    "terima kasih",
    "terima kasih.",
    "terima kasih telah menonton",
    "terima kasih sudah menonton",
    "jangan lupa like dan subscribe",
    "sampai jumpa di video berikutnya",
    "subtitle by",
    "subtitles by the amara.org community",
    "thank you.",
    "thank you for watching",
    "thanks for watching!",
    "you",
    "...",
}

_SPACES = re.compile(r"\s+")


@dataclass
class Piece:
    speaker_identity: str
    speaker_name: str
    start_ms: int
    end_ms: int
    text: str

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def clean_text(text: str) -> str:
    return _SPACES.sub(" ", text).strip()


def is_noise(text: str, duration_ms: int, no_speech_prob: float = 0.0) -> bool:
    """Likely not speech: empty, a known hallucination on a short piece, or flagged silent."""
    cleaned = clean_text(text).lower()
    if not cleaned or not re.search(r"\w", cleaned):
        return True
    if no_speech_prob >= 0.8:
        return True
    return cleaned.rstrip("!.") in {h.rstrip("!.") for h in HALLUCINATIONS} and duration_ms < 4_000


def merge(pieces: Iterable[Piece], join_gap_ms: int = 1_500, max_chars: int = 600) -> list[dict[str, object]]:
    """Order by start time and join consecutive pieces of the same speaker."""
    ordered = sorted(
        (p for p in pieces if clean_text(p.text)),
        key=lambda p: (p.start_ms, p.end_ms, p.speaker_identity),
    )
    merged: list[Piece] = []
    for piece in ordered:
        text = clean_text(piece.text)
        last = merged[-1] if merged else None
        if (
            last is not None
            and last.speaker_identity == piece.speaker_identity
            and piece.start_ms - last.end_ms <= join_gap_ms
            and len(last.text) + len(text) + 1 <= max_chars
        ):
            if not last.text.endswith(text):  # Whisper repetition loops
                last.text = f"{last.text} {text}"
            last.end_ms = max(last.end_ms, piece.end_ms)
            continue
        merged.append(
            Piece(piece.speaker_identity, piece.speaker_name, piece.start_ms, max(piece.end_ms, piece.start_ms), text)
        )
    return [p.as_dict() for p in merged]
