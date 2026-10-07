# RuangKerja "Notulen otomatis" worker (stage 1, CPU): records Video RuangKerja
# rooms as a hidden participant and transcribes after the meeting with
# faster-whisper. Runs next to LiveKit on the meeting server
# (docs/deploy/RAPAT-VIDEO.md "Notulen otomatis"). The Whisper model is
# downloaded on first start into /models (mount a volume to keep it).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models \
    WHISPER_MODEL_DIR=/models \
    TRANSCRIBER_SPOOL_DIR=/var/spool/notulen

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY notulen ./notulen
RUN useradd --system --uid 10001 --home-dir /app notulen \
    && mkdir -p /var/spool/notulen /models \
    && chown notulen /var/spool/notulen /models \
    && chmod 700 /var/spool/notulen
USER notulen

EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8090/health', timeout=3)"
CMD ["python", "-m", "notulen"]
