from notulen.merge import Piece, is_noise, merge


def p(who, start, end, text):
    return Piece(who, who.upper(), start, end, text)


def test_orders_by_time_across_speakers():
    out = merge([p("b", 3000, 4000, "dua"), p("a", 1000, 2000, "satu"), p("a", 5000, 6000, "tiga")])
    assert [(s["speaker_identity"], s["text"]) for s in out] == [("a", "satu"), ("b", "dua"), ("a", "tiga")]
    assert out[0] == {"speaker_identity": "a", "speaker_name": "A", "start_ms": 1000, "end_ms": 2000, "text": "satu"}


def test_joins_consecutive_pieces_of_one_speaker_with_small_gaps():
    out = merge([p("a", 0, 1000, "Selamat pagi"), p("a", 1500, 3000, " semuanya. "), p("a", 9000, 9500, "Lanjut")])
    assert [s["text"] for s in out] == ["Selamat pagi semuanya.", "Lanjut"]
    assert out[0]["end_ms"] == 3000


def test_does_not_join_when_too_long_and_drops_repeats_and_empties():
    long = "x" * 395
    out = merge([p("a", 0, 1000, long), p("a", 1100, 2000, "tambahan"), p("a", 2100, 2200, "  ")])
    assert len(out) == 2
    out = merge([p("a", 0, 1000, "oke"), p("a", 1100, 2000, "oke")])
    assert out[0]["text"] == "oke"


def test_noise_filter():
    assert is_noise("", 1000)
    assert is_noise(" ... ", 1000)
    assert is_noise("Terima kasih telah menonton!", 2000)
    assert not is_noise("Terima kasih telah menonton!", 9000)  # long enough to be real
    assert is_noise("Kita mulai", 2000, no_speech_prob=0.9)
    assert not is_noise("Kita mulai rapatnya", 2000, no_speech_prob=0.1)
