import os
import wave

from notulen.spool import SAMPLE_RATE, SpeakerTrack, Spool


def pcm(ms: int) -> bytes:
    return b"\x01\x00" * (SAMPLE_RATE * ms // 1000)


def test_speaker_track_splits_on_gaps_and_length(tmp_path):
    track = SpeakerTrack(tmp_path, 1, "u1", "Rina", gap_ms=2000, max_segment_ms=1000)
    for t in (10, 20, 30):  # 10 ms frames arriving every 10 ms
        track.write(t, pcm(10))
    track.write(5030, pcm(10))  # 5 s silence -> new file at the new offset
    assert [(s.file, s.start_ms) for s in track.segments] == [("s001-0001.wav", 0), ("s001-0002.wav", 5020)]
    for i in range(1, 120):  # 1.19 s of continuous audio -> cut at max_segment_ms
        track.write(5030 + i * 10, pcm(10))
    track.close()
    assert len(track.segments) == 3
    assert track.segments[2].start_ms == track.segments[1].end_ms
    with wave.open(str(tmp_path / "s001-0001.wav")) as handle:
        assert handle.getframerate() == SAMPLE_RATE and handle.getnchannels() == 1
        assert handle.getnframes() == 3 * 160


def test_drop_deletes_everything_of_that_speaker(tmp_path):
    track = SpeakerTrack(tmp_path, 2, "u2", "Budi")
    track.write(10, pcm(10))
    track.drop()
    assert track.segments == []
    assert list(tmp_path.glob("*.wav")) == []


def test_empty_files_are_removed_on_close(tmp_path):
    track = SpeakerTrack(tmp_path, 3, "u3", "Sari")
    track._open(0)
    track.close()
    assert list(tmp_path.glob("*.wav")) == []


def test_spool_cleanup(tmp_path):
    spool = Spool(tmp_path)
    old = spool.session_dir("rk-room-a", "s1")
    fresh = spool.session_dir("rk-room-b", "s2")
    (old / "s001-0001.wav").write_bytes(b"x")
    (fresh / "manifest.json").write_text("{}")
    past = 1_000_000.0
    os.utime(old / "s001-0001.wav", (past, past))
    os.utime(old, (past, past))
    removed = spool.purge_older_than(24, now=past + 25 * 3600)
    assert removed == [old]
    assert not (tmp_path / "rk-room-a").exists()  # empty room folder removed too
    assert fresh.exists()
    assert Spool.delete_audio(fresh) == 0
    (fresh / "a.wav").write_bytes(b"x")
    assert Spool.delete_audio(fresh) == 1
    assert (fresh / "manifest.json").exists()


def test_json_roundtrip_is_atomic(tmp_path):
    path = tmp_path / "manifest.json"
    Spool.write_json(path, {"nama": "Rapat Ü"})
    assert Spool.read_json(path) == {"nama": "Rapat Ü"}
    assert not list(tmp_path.glob("*.tmp"))
    path.write_text("not json")
    assert Spool.read_json(path) is None
