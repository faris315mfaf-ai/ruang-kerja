"""Who may be recorded.

A participant is never subscribed to (so no audio ever reaches this worker) when:
- their LiveKit attribute ``rk_notulen_optout`` is set ("Jangan transkrip suara saya";
  the app puts it in the access token, the room page updates it live), or
- the app listed their identity as excluded when asking the worker to join, or
- they are not a regular person (agents, egress, other hidden workers, ourselves).
Only microphone tracks are recorded; screen-share audio is not speech of the sharer.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

OPTOUT_ATTRIBUTE = "rk_notulen_optout"
_TRUTHY = {"1", "true", "yes", "ya", "on"}


def attribute_opted_out(attributes: Mapping[str, str] | None) -> bool:
    if not attributes:
        return False
    return str(attributes.get(OPTOUT_ATTRIBUTE, "")).strip().lower() in _TRUTHY


def may_record(
    identity: str,
    attributes: Mapping[str, str] | None,
    *,
    own_identity: str,
    excluded: Iterable[str] = (),
    is_standard: bool = True,
) -> bool:
    if not identity or identity == own_identity or not is_standard:
        return False
    if identity in set(excluded):
        return False
    return not attribute_opted_out(attributes)


def is_microphone(kind: str, source: str) -> bool:
    """Track kind/source names as strings ("audio", "microphone")."""
    return kind.lower().endswith("audio") and source.lower().endswith("microphone")
