from notulen.signing import SIGNATURE_HEADER, TIMESTAMP_HEADER, ReplayGuard, sign, signature, verify

SECRET = "s" * 40
BODY = b'{"action":"join","room":"rk-01hzzzzzzzzzzzzzzzzzzzzzzz-20261007"}'


def test_signature_matches_the_php_scheme():
    # hex(HMAC-SHA256(secret, "<ts>.<body>")): the same vector is asserted in the Pest suite.
    assert signature("key", 1700000000, b"{}") == "9d713ed406bb7076d4123f0dc2c39d2df5c654ed4b0cd56b52c8b4c940bd63ae"


def test_valid_signature_is_accepted():
    headers = sign(SECRET, BODY, now=1000)
    assert verify(SECRET, BODY, headers[TIMESTAMP_HEADER], headers[SIGNATURE_HEADER], 300, now=1100) is None


def test_tampered_body_wrong_secret_and_missing_headers_are_refused():
    headers = sign(SECRET, BODY, now=1000)
    assert verify(SECRET, BODY + b" ", headers[TIMESTAMP_HEADER], headers[SIGNATURE_HEADER], 300, now=1000) == (
        "bad signature"
    )
    assert verify("x" * 40, BODY, headers[TIMESTAMP_HEADER], headers[SIGNATURE_HEADER], 300, now=1000) == (
        "bad signature"
    )
    assert verify(SECRET, BODY, None, headers[SIGNATURE_HEADER], 300, now=1000) == "missing signature"
    assert verify(SECRET, BODY, "abc", headers[SIGNATURE_HEADER], 300, now=1000) == "bad timestamp"
    assert verify(SECRET, BODY, headers[TIMESTAMP_HEADER], "v0=abc", 300, now=1000) == "bad signature"
    assert verify("", BODY, headers[TIMESTAMP_HEADER], headers[SIGNATURE_HEADER], 300, now=1000) == "not configured"


def test_stale_and_future_timestamps_are_refused():
    headers = sign(SECRET, BODY, now=1000)
    assert verify(SECRET, BODY, headers[TIMESTAMP_HEADER], headers[SIGNATURE_HEADER], 300, now=1301) == "stale"
    assert verify(SECRET, BODY, headers[TIMESTAMP_HEADER], headers[SIGNATURE_HEADER], 300, now=699) == "stale"


def test_replayed_signature_is_refused_until_it_expires():
    clock = [1000.0]
    guard = ReplayGuard(600, clock=lambda: clock[0])
    headers = sign(SECRET, BODY, now=1000)
    args = (SECRET, BODY, headers[TIMESTAMP_HEADER], headers[SIGNATURE_HEADER], 300, guard)
    assert verify(*args, now=1000) is None
    assert verify(*args, now=1001) == "replayed"
    clock[0] = 1700.0
    assert guard.first_use("other")
    assert len(guard._seen) == 1  # the old entry was forgotten
