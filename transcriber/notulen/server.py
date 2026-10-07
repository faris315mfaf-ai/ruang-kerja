"""Small authenticated HTTP API used by the app (TRANSCRIBER_URL).

    GET  /health                 liveness + queue (no secrets, no room names)
    POST /rooms/{room}/join      {"action": "join", "room", "token", "exclude": [identities]}
    POST /rooms/{room}/exclude   {"action": "exclude", "room", "identity", "excluded": true}
    POST /rooms/{room}/finish    {"action": "finish", "room"}

Both POSTs are HMAC-signed (``signing``); the body must name the same room and action
as the URL. The LiveKit token is minted by the app (identity rk-notulen, hidden,
subscribe only) and is never logged. The LiveKit URL comes from this worker's own
configuration, never from the request.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from aiohttp import web

from .config import Settings
from .jobs import Coordinator
from .signing import SIGNATURE_HEADER, TIMESTAMP_HEADER, ReplayGuard, verify

log = logging.getLogger(__name__)

MAX_BODY = 64 * 1024
COORDINATOR = web.AppKey("coordinator", Coordinator)
SETTINGS = web.AppKey("settings", Settings)
GUARD = web.AppKey("guard", ReplayGuard)


def _error(status: int, message: str) -> web.Response:
    return web.json_response({"message": message}, status=status)


async def _signed_body(request: web.Request, action: str) -> dict[str, Any] | web.Response:
    settings = request.app[SETTINGS]
    if request.content_length is not None and request.content_length > MAX_BODY:
        return _error(413, "too large")
    body = await request.read()
    if len(body) > MAX_BODY:
        return _error(413, "too large")
    problem = verify(
        settings.secret,
        body,
        request.headers.get(TIMESTAMP_HEADER),
        request.headers.get(SIGNATURE_HEADER),
        settings.tolerance_seconds,
        request.app[GUARD],
    )
    if problem is not None:
        return _error(401, problem)
    try:
        data = json.loads(body)
    except ValueError:
        return _error(422, "not json")
    room = request.match_info["room"]
    if not isinstance(data, dict) or data.get("action") != action or data.get("room") != room:
        return _error(422, "body does not match the request")
    if not Coordinator.valid_room(room):
        return _error(422, "unknown room format")
    return data


async def health(request: web.Request) -> web.Response:
    return web.json_response(request.app[COORDINATOR].health())


async def join(request: web.Request) -> web.Response:
    data = await _signed_body(request, "join")
    if isinstance(data, web.Response):
        return data
    token = data.get("token")
    exclude = data.get("exclude") or []
    if not isinstance(token, str) or not token or not isinstance(exclude, list):
        return _error(422, "token required")
    try:
        status = await request.app[COORDINATOR].join(data["room"], token, [str(x) for x in exclude][:500])
    except Exception:
        return _error(502, "could not join the room")
    return web.json_response({"status": status}, status=200 if status == "already" else 202)


async def exclude(request: web.Request) -> web.Response:
    data = await _signed_body(request, "exclude")
    if isinstance(data, web.Response):
        return data
    identity = data.get("identity")
    excluded = data.get("excluded")
    if not isinstance(identity, str) or not identity or not isinstance(excluded, bool):
        return _error(422, "identity and excluded required")
    status = request.app[COORDINATOR].exclude(data["room"], identity, excluded)
    # Not recording this room right now: nothing to do (the next join carries the list).
    return web.json_response({"status": status}, status=200)


async def finish(request: web.Request) -> web.Response:
    data = await _signed_body(request, "finish")
    if isinstance(data, web.Response):
        return data
    status = await request.app[COORDINATOR].finish(data["room"], "app")
    return web.json_response({"status": status}, status=404 if status == "unknown" else 202)


def create_app(settings: Settings, coordinator: Coordinator) -> web.Application:
    app = web.Application(client_max_size=MAX_BODY)
    app[SETTINGS] = settings
    app[COORDINATOR] = coordinator
    app[GUARD] = ReplayGuard(settings.tolerance_seconds * 2)
    app.router.add_get("/health", health)
    app.router.add_post("/rooms/{room}/join", join)
    app.router.add_post("/rooms/{room}/exclude", exclude)
    app.router.add_post("/rooms/{room}/finish", finish)

    async def on_startup(_: web.Application) -> None:
        await coordinator.start()

    async def on_cleanup(_: web.Application) -> None:
        await coordinator.close()

    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app
