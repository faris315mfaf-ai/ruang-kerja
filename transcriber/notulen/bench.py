"""Measure the real-time factor on this machine.

    python -m notulen.bench sample.wav [--model large-v3-turbo] [--threads 8] [--compute int8]

RTF = processing time / audio duration (0.25 = four times faster than real time).
The first run also downloads the model (excluded from the timing).
"""

from __future__ import annotations

import argparse
import time
import wave
from dataclasses import replace
from pathlib import Path

from .config import Settings
from .transcribe import FasterWhisperTranscriber


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path)
    parser.add_argument("--model", default="large-v3-turbo")
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--compute", default="int8")
    parser.add_argument("--beam", type=int, default=1)
    args = parser.parse_args()

    settings = replace(
        Settings.from_env(),
        model=args.model,
        cpu_threads=args.threads,
        compute_type=args.compute,
        beam_size=args.beam,
    )
    with wave.open(str(args.audio), "rb") as handle:
        duration = handle.getnframes() / handle.getframerate()

    transcriber = FasterWhisperTranscriber(settings)
    started = time.perf_counter()
    transcriber.load()
    loaded = time.perf_counter()
    pieces = transcriber.transcribe(args.audio)
    finished = time.perf_counter()

    elapsed = finished - loaded
    print(f"model={args.model} compute={args.compute} threads={args.threads} beam={args.beam}")
    print(f"audio={duration:.1f}s load={loaded - started:.1f}s transcribe={elapsed:.1f}s RTF={elapsed / duration:.3f}")
    for piece in pieces:
        print(f"[{piece.start:6.1f}-{piece.end:6.1f}] {piece.text.strip()}")


if __name__ == "__main__":
    main()
