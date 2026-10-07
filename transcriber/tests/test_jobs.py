import asyncio

from notulen.jobs import Coordinator

from .conftest import ROOM, FakeApp, FakeRecorder, FakeTranscriber


async def drain(coordinator: Coordinator) -> None:
    while not coordinator.queue.empty():
        await coordinator.process(coordinator.queue.get_nowait())


async def test_join_record_finish_transcribe_post_and_delete(coordinator, fakes, settings):
    _, app = fakes
    assert await coordinator.join(ROOM, "jwt", exclude := []) == "joining"
    assert await coordinator.join(ROOM, "jwt", exclude) == "already"
    assert FakeRecorder.instances[0].token == "jwt"
    await asyncio.sleep(0)  # the "recording" status is posted in the background

    assert await coordinator.finish(ROOM) == "finishing"
    assert await coordinator.finish(ROOM) == "unknown"
    assert FakeRecorder.instances[0].stopped
    await drain(coordinator)

    statuses = [p["status"] for p in app.posts]
    assert statuses == ["recording", "transcribing", "ready"]
    ready = app.posts[-1]
    assert ready["room"] == ROOM and ready["language"] == "id" and ready["model"] == "faster-whisper/fake"
    assert [(s["speaker_identity"], s["speaker_name"]) for s in ready["segments"]] == [
        ("01HZA", "Rina"),
        ("01HZB", "Budi"),
    ]
    # Offsets are wall-clock: Rina's audio started at 0 ms, Budi's at 2000 ms (frame end 3000 ms - 1 s).
    assert [s["start_ms"] for s in ready["segments"]] == [100, 2100]
    # Audio and the whole session folder are gone once the app accepted the transcript.
    assert not list(settings.spool_dir.rglob("*.wav"))
    assert not list(settings.spool_dir.rglob("*.json"))


async def test_excluded_people_are_never_recorded(coordinator, fakes):
    _, app = fakes
    await coordinator.join(ROOM, "jwt", ["01HZB"])
    await coordinator.finish(ROOM)
    await drain(coordinator)
    assert {s["speaker_identity"] for s in app.posts[-1]["segments"]} == {"01HZA"}


async def test_failed_transcription_reports_and_still_deletes_audio(settings):
    app = FakeApp()
    coordinator = Coordinator(settings, FakeTranscriber(fail=True), app, FakeRecorder)
    await coordinator.join(ROOM, "jwt")
    await coordinator.finish(ROOM)
    await drain(coordinator)
    assert app.posts[-1]["status"] == "failed"
    assert "RuntimeError" in app.posts[-1]["error"]
    assert not list(settings.spool_dir.rglob("*.wav"))


async def test_undelivered_transcript_is_kept_without_audio_and_retried_after_restart(settings):
    app = FakeApp(accept=False)
    coordinator = Coordinator(settings, FakeTranscriber(), app, FakeRecorder)
    await coordinator.join(ROOM, "jwt")
    await coordinator.finish(ROOM)
    await drain(coordinator)
    assert not list(settings.spool_dir.rglob("*.wav"))
    assert len(list(settings.spool_dir.rglob("result.json"))) == 1

    transcriber = FakeTranscriber()
    restarted = Coordinator(settings, transcriber, FakeApp(), FakeRecorder)
    restarted.recover()
    await drain(restarted)
    assert transcriber.files == []  # not transcribed again
    assert restarted.app.posts[-1]["status"] == "ready"
    assert not list(settings.spool_dir.rglob("*.json"))


async def test_room_ending_by_itself_finishes_the_session(coordinator):
    await coordinator.join(ROOM, "jwt")
    FakeRecorder.instances[0].on_ended("empty")
    for _ in range(5):
        await asyncio.sleep(0)
    assert ROOM not in coordinator.sessions
    assert coordinator.queue.qsize() == 1


def test_room_names_follow_the_app_pattern():
    assert Coordinator.valid_room(ROOM)
    assert not Coordinator.valid_room("rk-../../etc-20261007")
    assert not Coordinator.valid_room("uji-koneksi")
