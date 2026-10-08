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


async def test_opt_out_during_the_meeting_deletes_that_persons_audio(coordinator, fakes, settings):
    _, app = fakes
    await coordinator.join(ROOM, "jwt")
    assert coordinator.exclude(ROOM, "01HZA", True) == "applied"
    assert coordinator.exclude("rk-01hzx3k9q2w8e7r6t5y4v3m2n9-20261007", "01HZA", True) == "unknown"
    assert len(list(settings.spool_dir.rglob("*.wav"))) == 1
    await coordinator.finish(ROOM)
    await drain(coordinator)
    assert {s["speaker_identity"] for s in app.posts[-1]["segments"]} == {"01HZB"}


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


async def test_spool_cap_stops_running_recordings(coordinator, settings, caplog):
    await coordinator.join(ROOM, "jwt")
    object.__setattr__(settings, "spool_max_gb", 1 / 1024**3)
    with caplog.at_level("CRITICAL"):
        await coordinator.enforce_spool_cap()
    assert ROOM not in coordinator.sessions
    assert coordinator.queue.qsize() == 1  # what was recorded is still transcribed
    assert "ALERT spool full" in caplog.text


async def test_restart_cleans_orphans_and_interrupted_recordings(settings, fakes):
    _, app = fakes
    first = Coordinator(settings, FakeTranscriber(), app, FakeRecorder)
    await first.join(ROOM, "jwt")  # crash while recording: manifest state "recording"
    orphan = first.spool.session_dir("rk-01hzx3k9q2w8e7r6t5y4v3m2n9-20261007", "x")
    (orphan / "s001-0001.wav").write_bytes(b"x")
    (settings.spool_dir / "left.json.tmp").write_text("{}")

    restarted = Coordinator(settings, FakeTranscriber(), app, FakeRecorder)
    restarted.recover()
    await asyncio.sleep(0)
    assert restarted.queue.empty()
    assert not list(settings.spool_dir.rglob("*.wav")) and not list(settings.spool_dir.rglob("*.tmp"))
    assert app.posts[-1]["status"] == "failed" and app.posts[-1]["room"] == ROOM
