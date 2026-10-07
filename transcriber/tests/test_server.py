import json
import secrets

import pytest

from notulen.server import create_app
from notulen.signing import sign

from .conftest import ROOM, SECRET


@pytest.fixture
async def client(aiohttp_client, settings, coordinator):
    return await aiohttp_client(create_app(settings, coordinator))


def signed(payload: dict, secret: str = SECRET, now: float | None = None):
    # The app adds a random nonce, so two identical requests in one second are not "replays".
    body = json.dumps({**payload, "nonce": secrets.token_hex(8)}).encode()
    return body, sign(secret, body, now=now)


async def test_health_needs_no_signature(client):
    response = await client.get("/health")
    assert response.status == 200
    # Minimal: nothing about the model, versions, paths or rooms.
    assert await response.json() == {"status": "ok"}


async def test_join_and_finish_with_a_valid_signature(client):
    body, headers = signed({"action": "join", "room": ROOM, "token": "jwt", "exclude": ["01HZB"]})
    response = await client.post(f"/rooms/{ROOM}/join", data=body, headers=headers)
    assert response.status == 202 and (await response.json())["status"] == "joining"

    body, headers = signed({"action": "exclude", "room": ROOM, "identity": "01HZA", "excluded": True})
    response = await client.post(f"/rooms/{ROOM}/exclude", data=body, headers=headers)
    assert response.status == 200 and (await response.json())["status"] == "applied"

    body, headers = signed({"action": "exclude", "room": ROOM, "identity": "01HZA"})
    assert (await client.post(f"/rooms/{ROOM}/exclude", data=body, headers=headers)).status == 422

    body, headers = signed({"action": "finish", "room": ROOM})
    response = await client.post(f"/rooms/{ROOM}/finish", data=body, headers=headers)
    assert response.status == 202

    body, headers = signed({"action": "finish", "room": ROOM})
    response = await client.post(f"/rooms/{ROOM}/finish", data=body, headers=headers)
    assert response.status == 404


async def test_bad_stale_replayed_or_mismatched_requests_are_refused(client):
    payload = {"action": "join", "room": ROOM, "token": "jwt"}
    body, headers = signed(payload, secret="x" * 40)
    assert (await client.post(f"/rooms/{ROOM}/join", data=body, headers=headers)).status == 401

    body, headers = signed(payload, now=1000)
    assert (await client.post(f"/rooms/{ROOM}/join", data=body, headers=headers)).status == 401

    body, headers = signed(payload)
    assert (await client.post(f"/rooms/{ROOM}/join", data=body, headers=headers)).status == 202
    assert (await client.post(f"/rooms/{ROOM}/join", data=body, headers=headers)).status == 401  # replay

    other = "rk-01hzx3k9q2w8e7r6t5y4v3m2n9-20261007"
    body, headers = signed({"action": "join", "room": ROOM, "token": "jwt"})
    assert (await client.post(f"/rooms/{other}/join", data=body, headers=headers)).status == 422

    body, headers = signed({"action": "finish", "room": ROOM})
    assert (await client.post(f"/rooms/{ROOM}/join", data=body, headers=headers)).status == 422

    body, headers = signed({"action": "join", "room": ROOM})
    assert (await client.post(f"/rooms/{ROOM}/join", data=body, headers=headers)).status == 422

    assert (await client.post(f"/rooms/{ROOM}/join", data=b"{}")).status == 401


async def test_replay_guard_survives_a_restart(aiohttp_client, settings, coordinator):
    body, headers = signed({"action": "finish", "room": ROOM})
    first = await aiohttp_client(create_app(settings, coordinator))
    assert (
        await first.post(f"/rooms/{ROOM}/finish", data=body, headers=headers)
    ).status == 404  # accepted, unknown room
    second = await aiohttp_client(create_app(settings, coordinator))  # new process, same spool
    assert (await second.post(f"/rooms/{ROOM}/finish", data=body, headers=headers)).status == 401


async def test_spool_full_refuses_to_record(client, settings):
    settings.spool_dir.mkdir(parents=True, exist_ok=True)
    (settings.spool_dir / "big.bin").write_bytes(b"x" * 2048)
    object.__setattr__(settings, "spool_max_gb", 1 / 1024**3)  # 1 byte cap
    body, headers = signed({"action": "join", "room": ROOM, "token": "jwt"})
    assert (await client.post(f"/rooms/{ROOM}/join", data=body, headers=headers)).status == 507
