"""Worker → app: status updates and the transcript (POST /api/notulen/transcript)."""

from __future__ import annotations

import asyncio
import json
import logging
import ssl
from collections.abc import Awaitable, Callable
from typing import Any

import aiohttp

from .config import Settings
from .signing import sign

log = logging.getLogger(__name__)

TRANSCRIPT_PATH = "/api/notulen/transcript"


class AppClient:
    def __init__(
        self,
        settings: Settings,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self.settings = settings
        self._sleep = sleep
        self._session: aiohttp.ClientSession | None = None

    async def close(self) -> None:
        if self._session is not None:
            await self._session.close()
            self._session = None

    async def post(self, payload: dict[str, Any], attempts: int = 6) -> bool:
        """True once the app accepted it (2xx). Retries network errors, 408/429/5xx."""
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
        url = self.settings.app_url + TRANSCRIPT_PATH
        delay = 2.0
        for attempt in range(1, attempts + 1):
            try:
                status = await self._send(url, body)
            except (aiohttp.ClientError, TimeoutError) as error:
                status = None
                log.warning("app unreachable (attempt %d): %s", attempt, type(error).__name__)
            if status is not None and 200 <= status < 300:
                return True
            if status is not None and 400 <= status < 500 and status not in (408, 429):
                log.error("app refused %s for room %s: HTTP %d", payload.get("status"), payload.get("room"), status)
                return False
            if attempt < attempts:
                await self._sleep(delay)
                delay = min(delay * 2, 60.0)
        return False

    async def _send(self, url: str, body: bytes) -> int:
        if self._session is None:
            context = ssl.create_default_context()
            if self.settings.ca_file is not None:
                context.load_verify_locations(cafile=str(self.settings.ca_file))
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30),
                connector=aiohttp.TCPConnector(ssl=context),
            )
        # Signed right before sending: retries get a fresh timestamp.
        async with self._session.post(url, data=body, headers=sign(self.settings.callback_secret, body)) as response:
            await response.read()
            return response.status
