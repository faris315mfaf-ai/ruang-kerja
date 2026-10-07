"""python -m notulen — start the worker (HTTP API + recorder + transcription queue)."""

from __future__ import annotations

import logging
import sys

from aiohttp import web

from .appclient import AppClient
from .config import Settings
from .jobs import Coordinator
from .recorder import make_recorder
from .server import create_app
from .transcribe import FasterWhisperTranscriber


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    # The LiveKit SDK logs at INFO per frame/stat; keep the worker log readable.
    logging.getLogger("livekit").setLevel(logging.WARNING)
    settings = Settings.from_env()
    problems = settings.problems()
    if problems:
        for problem in problems:
            logging.error("config: %s", problem)
        return 2
    coordinator = Coordinator(settings, FasterWhisperTranscriber(settings), AppClient(settings), make_recorder)
    logging.info("notulen worker on %s:%d, %r", settings.host, settings.port, settings)
    web.run_app(create_app(settings, coordinator), host=settings.host, port=settings.port, print=None)
    return 0


if __name__ == "__main__":
    sys.exit(main())
