"""HMAC signatures between the app and the worker (both directions, same scheme).

    X-Notulen-Timestamp: <unix seconds>
    X-Notulen-Signature: v1=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>

The body names the room and the action, so the URL path is not signed (proxies may
strip a prefix). A receiver refuses timestamps outside the tolerance window and any
signature it has already accepted (replay), see ``ReplayGuard``. Mirrors
App\\Domain\\Meetings\\Services\\NotulenSignature on the PHP side.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from collections.abc import Callable

TIMESTAMP_HEADER = "X-Notulen-Timestamp"
SIGNATURE_HEADER = "X-Notulen-Signature"
VERSION = "v1"


def signature(secret: str, timestamp: int, body: bytes) -> str:
    message = str(timestamp).encode() + b"." + body
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def sign(secret: str, body: bytes, now: float | None = None) -> dict[str, str]:
    """Headers for a signed request with this exact body."""
    timestamp = int(now if now is not None else time.time())
    return {
        TIMESTAMP_HEADER: str(timestamp),
        SIGNATURE_HEADER: f"{VERSION}={signature(secret, timestamp, body)}",
        "Content-Type": "application/json",
    }


class ReplayGuard:
    """Remembers accepted signatures for twice the tolerance window (in memory)."""

    def __init__(self, ttl_seconds: int, clock: Callable[[], float] = time.time) -> None:
        self._ttl = ttl_seconds
        self._clock = clock
        self._seen: dict[str, float] = {}

    def first_use(self, sig: str) -> bool:
        now = self._clock()
        for key, expires in list(self._seen.items()):
            if expires <= now:
                del self._seen[key]
        if sig in self._seen:
            return False
        self._seen[sig] = now + self._ttl
        return True


def verify(
    secret: str,
    body: bytes,
    timestamp_header: str | None,
    signature_header: str | None,
    tolerance_seconds: int,
    guard: ReplayGuard | None = None,
    now: float | None = None,
) -> str | None:
    """None when valid, otherwise a short reason (never echo secrets)."""
    if not secret:
        return "not configured"
    if not timestamp_header or not signature_header:
        return "missing signature"
    try:
        timestamp = int(timestamp_header)
    except ValueError:
        return "bad timestamp"
    current = now if now is not None else time.time()
    if abs(current - timestamp) > tolerance_seconds:
        return "stale"
    prefix = f"{VERSION}="
    if not signature_header.startswith(prefix):
        return "bad signature"
    given = signature_header[len(prefix) :]
    expected = signature(secret, timestamp, body)
    if not hmac.compare_digest(expected, given):
        return "bad signature"
    if guard is not None and not guard.first_use(given):
        return "replayed"
    return None
