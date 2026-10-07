from notulen.optout import OPTOUT_ATTRIBUTE, attribute_opted_out, is_microphone, may_record


def test_attribute_values():
    assert attribute_opted_out({OPTOUT_ATTRIBUTE: "1"})
    assert attribute_opted_out({OPTOUT_ATTRIBUTE: "true"})
    assert not attribute_opted_out({OPTOUT_ATTRIBUTE: "0"})
    assert not attribute_opted_out({OPTOUT_ATTRIBUTE: ""})
    assert not attribute_opted_out({"hand": "1"})
    assert not attribute_opted_out(None)


def test_who_may_be_recorded():
    me = "rk-notulen"
    assert may_record("01HZ", {}, own_identity=me)
    assert not may_record("01HZ", {OPTOUT_ATTRIBUTE: "1"}, own_identity=me)
    assert not may_record("01HZ", {}, own_identity=me, excluded=["01HZ"])
    assert not may_record(me, {}, own_identity=me)
    assert not may_record("agent-1", {}, own_identity=me, is_standard=False)
    assert not may_record("", {}, own_identity=me)


def test_only_microphones():
    assert is_microphone("KIND_AUDIO", "SOURCE_MICROPHONE")
    assert not is_microphone("KIND_AUDIO", "SOURCE_SCREENSHARE_AUDIO")
    assert not is_microphone("KIND_VIDEO", "SOURCE_CAMERA")
