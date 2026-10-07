"""RuangKerja "Notulen otomatis" worker (stage 1: after-meeting transcription on CPU).

Joins a Video RuangKerja room (LiveKit) as a hidden participant when the app asks,
records each participant's microphone to a local spool (16 kHz mono WAV, wall-clock
offsets), and after the meeting transcribes every speaker with faster-whisper,
merges the segments by time, posts the transcript to the app (HMAC-signed) and
deletes the audio. See docs/deploy/RAPAT-VIDEO.md "Notulen otomatis".
"""

__version__ = "0.1.0"
