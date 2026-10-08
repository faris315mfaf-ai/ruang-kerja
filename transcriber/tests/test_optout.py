from notulen.optout import is_microphone, may_record


def test_who_may_be_recorded():
    me = "rk-notulen"
    assert may_record("01HZ", own_identity=me)
    assert not may_record("01HZ", own_identity=me, excluded=["01HZ"])
    assert not may_record(me, own_identity=me)
    assert not may_record("agent-1", own_identity=me, is_standard=False)
    assert not may_record("", own_identity=me)


def test_public_attributes_are_not_an_opt_out_channel():
    # Opt-out is private: only the app's signed exclude list counts, never a LiveKit attribute.
    import inspect

    import notulen.optout as module

    assert "attributes" not in inspect.signature(may_record).parameters
    assert "rk_notulen_optout" not in inspect.getsource(module)


def test_only_microphones():
    assert is_microphone("KIND_AUDIO", "SOURCE_MICROPHONE")
    assert not is_microphone("KIND_AUDIO", "SOURCE_SCREENSHARE_AUDIO")
    assert not is_microphone("KIND_VIDEO", "SOURCE_CAMERA")
