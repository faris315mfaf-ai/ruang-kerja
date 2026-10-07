"""LiveKit side: join as a hidden participant and spool every allowed microphone.

The worker subscribes manually (``auto_subscribe=False``): a track is subscribed only
when its owner may be recorded (``optout.may_record``), so audio of people who opted
out never reaches this process. When someone opts out during the meeting, their
subscription ends and everything already recorded for them is deleted.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Any

from livekit import rtc

from .config import Settings
from .optout import is_microphone, may_record
from .spool import SpeakerTrack, Spool

log = logging.getLogger(__name__)

HUMAN_KINDS = {rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD, rtc.ParticipantKind.PARTICIPANT_KIND_SIP}


class LiveKitRecorder:
    def __init__(
        self,
        settings: Settings,
        room_name: str,
        token: str,
        directory: Path,
        excluded: Iterable[str],
        on_ended: Callable[[str], None],
    ) -> None:
        self.settings = settings
        self.room_name = room_name
        self.token = token
        self.directory = directory
        self.excluded = set(excluded)
        self.on_ended = on_ended
        self.room: rtc.Room | None = None
        self.speakers: dict[str, SpeakerTrack] = {}
        self.readers: dict[str, asyncio.Task[None]] = {}  # track sid -> reader
        self._t0 = time.monotonic()
        self._watch: asyncio.Task[None] | None = None
        self._stopped = False

    # -- lifecycle -------------------------------------------------------------

    async def start(self) -> None:
        room = rtc.Room()
        self.room = room
        room.on("track_published", self._on_published)
        room.on("track_subscribed", self._on_subscribed)
        room.on("track_unsubscribed", self._on_unsubscribed)
        room.on("participant_attributes_changed", self._on_attributes)
        room.on("participant_disconnected", self._on_participant_left)
        room.on("disconnected", self._on_disconnected)
        await room.connect(self.settings.livekit_url, self.token, rtc.RoomOptions(auto_subscribe=False))
        self._t0 = time.monotonic()
        for participant in room.remote_participants.values():
            self._consider_participant(participant)
        self._watch = asyncio.create_task(self._watch_room())
        log.info("recording room %s", self.room_name)

    async def stop(self) -> None:
        if self._stopped:
            return
        self._stopped = True
        if self._watch is not None:
            self._watch.cancel()
        for task in list(self.readers.values()):
            task.cancel()
        for task in list(self.readers.values()):
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task
        self.readers.clear()
        for speaker in self.speakers.values():
            speaker.close()
        if self.room is not None:
            with contextlib.suppress(Exception):
                await self.room.disconnect()
        log.info("stopped recording room %s", self.room_name)

    def manifest_speakers(self) -> dict[str, Any]:
        return {identity: s.to_manifest() for identity, s in self.speakers.items() if s.segments}

    # -- rules -----------------------------------------------------------------

    def _allowed(self, participant: rtc.RemoteParticipant) -> bool:
        return may_record(
            participant.identity,
            dict(participant.attributes),
            own_identity=self.settings.identity,
            excluded=self.excluded,
            is_standard=participant.kind in HUMAN_KINDS,
        )

    def _consider_participant(self, participant: rtc.RemoteParticipant) -> None:
        for publication in participant.track_publications.values():
            self._consider(publication, participant)

    def _consider(self, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant) -> None:
        mic = is_microphone(rtc.TrackKind.Name(publication.kind), rtc.TrackSource.Name(publication.source))
        if not mic:
            return
        wanted = self._allowed(participant) and not self._stopped
        if publication.subscribed != wanted:
            publication.set_subscribed(wanted)

    # -- events ----------------------------------------------------------------

    def _on_published(self, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant) -> None:
        self._consider(publication, participant)

    def _on_subscribed(
        self, track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant
    ) -> None:
        if track.kind != rtc.TrackKind.KIND_AUDIO or not self._allowed(participant) or self._stopped:
            return
        speaker = self.speakers.get(participant.identity)
        if speaker is None:
            speaker = SpeakerTrack(
                directory=self.directory,
                index=len(self.speakers) + 1,
                identity=participant.identity,
                name=participant.name or participant.identity,
                max_segment_ms=self.settings.max_segment_seconds * 1000,
            )
            self.speakers[participant.identity] = speaker
        elif participant.name:
            speaker.name = participant.name
        if publication.sid not in self.readers:
            self.readers[publication.sid] = asyncio.create_task(self._read(track, participant, speaker))

    def _on_unsubscribed(
        self, track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant
    ) -> None:
        task = self.readers.pop(publication.sid, None)
        if task is not None:
            task.cancel()
        speaker = self.speakers.get(participant.identity)
        if speaker is not None:
            speaker.close()

    def set_excluded(self, identity: str, excluded: bool) -> None:
        """The app relays a consent change ("Jangan transkrip suara saya")."""
        if excluded:
            self.excluded.add(identity)
        else:
            self.excluded.discard(identity)
        participant = self.room.remote_participants.get(identity) if self.room else None
        if participant is not None:
            self._reevaluate(participant)
        elif excluded:
            speaker = self.speakers.pop(identity, None)
            if speaker is not None:
                speaker.drop()

    def _on_attributes(self, changed: dict[str, str], participant: rtc.Participant) -> None:
        if isinstance(participant, rtc.RemoteParticipant):
            self._reevaluate(participant)

    def _reevaluate(self, participant: rtc.RemoteParticipant) -> None:
        if not self._allowed(participant):
            for sid, publication in participant.track_publications.items():
                task = self.readers.pop(sid, None)
                if task is not None:
                    task.cancel()
                if publication.subscribed:
                    publication.set_subscribed(False)
            speaker = self.speakers.pop(participant.identity, None)
            if speaker is not None:
                speaker.drop()
                log.info("participant opted out; their audio was deleted")
            return
        self._consider_participant(participant)

    def _on_participant_left(self, participant: rtc.RemoteParticipant) -> None:
        speaker = self.speakers.get(participant.identity)
        if speaker is not None:
            speaker.close()

    def _on_disconnected(self, reason: Any = None) -> None:
        if not self._stopped:
            self.on_ended("disconnected")

    # -- audio -----------------------------------------------------------------

    async def _read(self, track: rtc.Track, participant: rtc.RemoteParticipant, speaker: SpeakerTrack) -> None:
        stream = rtc.AudioStream.from_track(track=track, sample_rate=16_000, num_channels=1)
        try:
            async for event in stream:
                if self._stopped or speaker.identity not in self.speakers:
                    break
                received_ms = int((time.monotonic() - self._t0) * 1000)
                speaker.write(received_ms, bytes(event.frame.data.cast("B")))
        finally:
            with contextlib.suppress(Exception):
                await stream.aclose()

    async def _watch_room(self) -> None:
        """End the session when the room stays without people, or at the length cap."""
        empty_since: float | None = None
        deadline = self._t0 + self.settings.max_recording_minutes * 60
        while not self._stopped:
            await asyncio.sleep(5)
            room = self.room
            humans = [p for p in (room.remote_participants.values() if room else []) if p.kind in HUMAN_KINDS]
            now = time.monotonic()
            empty_since = (empty_since or now) if not humans else None
            if empty_since is not None and now - empty_since >= self.settings.empty_grace_seconds:
                self.on_ended("empty")
                return
            if now >= deadline:
                self.on_ended("max_duration")
                return


def make_recorder(
    settings: Settings,
    room_name: str,
    token: str,
    directory: Path,
    excluded: Iterable[str],
    on_ended: Callable[[str], None],
) -> LiveKitRecorder:
    return LiveKitRecorder(settings, room_name, token, directory, excluded, on_ended)


__all__ = ["LiveKitRecorder", "Spool", "make_recorder"]
