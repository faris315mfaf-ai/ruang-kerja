from dataclasses import replace

from notulen.config import Settings


def test_two_distinct_secrets_and_localhost_by_default():
    base = Settings(secret="a" * 32, callback_secret="b" * 32, app_url="https://app", livekit_url="ws://lk")
    assert base.problems() == []
    assert base.host == "127.0.0.1"
    assert "TRANSCRIBER_CALLBACK_SECRET must differ" in " ".join(replace(base, callback_secret="a" * 32).problems())
    assert "TRANSCRIBER_CALLBACK_SECRET must be" in " ".join(replace(base, callback_secret="").problems())
    assert "a" * 32 not in repr(base)
