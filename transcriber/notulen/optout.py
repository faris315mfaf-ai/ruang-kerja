"""Who may be recorded.

A participant is never subscribed to (so no audio ever reaches this worker) when:
- the app listed their identity as excluded ("Jangan transkrip suara saya"), either in
  the join request or later through the signed ``/rooms/{room}/exclude`` call — the
  choice stays private between the person, the app and this worker (it is deliberately
  NOT a LiveKit participant attribute, which every client in the room would receive), or
- they are not a regular person (agents, egress, other hidden workers, ourselves), or
- they are an external guest of the meeting (identity ``guest:<id>``): guests are invited
  by a link without an account, never consented to a transcript, and are never recorded.
Only microphone tracks are recorded; screen-share audio is not speech of the sharer.
"""

from __future__ import annotations

from collections.abc import Iterable

GUEST_PREFIX = "guest:"


def may_record(
    identity: str,
    *,
    own_identity: str,
    excluded: Iterable[str] = (),
    is_standard: bool = True,
) -> bool:
    if not identity or identity == own_identity or not is_standard:
        return False
    if identity.startswith(GUEST_PREFIX):
        return False
    return identity not in set(excluded)


def is_microphone(kind: str, source: str) -> bool:
    """Track kind/source names as strings ("KIND_AUDIO", "SOURCE_MICROPHONE")."""
    return kind.lower().endswith("audio") and source.lower().endswith("microphone")
