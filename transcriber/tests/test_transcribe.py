from dataclasses import replace

import pytest

from notulen.transcribe import PINNED, ModelError, file_sha256, resolve_model


def fake_download(folder, content=b"weights"):
    calls = []

    def download(repo, cache_dir=None, revision=None):
        calls.append((repo, revision))
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "model.bin").write_bytes(content)
        return str(folder)

    return download, calls


def test_builtin_models_are_pinned_to_a_commit_and_checksum(settings, tmp_path):
    download, calls = fake_download(tmp_path / "m")
    with pytest.raises(ModelError, match="checksum"):
        resolve_model(settings, download)  # fake weights do not match the pinned hash
    assert calls == [(PINNED["large-v3-turbo"].repo, PINNED["large-v3-turbo"].revision)]


def test_custom_repo_needs_a_revision_and_matching_checksum(settings, tmp_path):
    download, _ = fake_download(tmp_path / "m")
    with pytest.raises(ModelError, match="not pinned"):
        resolve_model(replace(settings, model="org/other-whisper"), download)

    (tmp_path / "probe").write_bytes(b"weights")
    good = file_sha256(tmp_path / "probe")
    pinned = replace(settings, model="org/other-whisper", model_revision="abc123", model_sha256=good)
    assert resolve_model(pinned, download) == tmp_path / "m"
    with pytest.raises(ModelError):
        resolve_model(replace(pinned, model_sha256="0" * 64), download)
