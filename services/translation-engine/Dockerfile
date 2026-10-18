# Software Vala translation engine.
# Models are not baked in; they are mounted read-only at /models
# (see deploy/install-models.sh).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN useradd --system --uid 10010 --home-dir /app --shell /usr/sbin/nologin svt
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY routing.json ./
COPY sv_translate ./sv_translate
COPY tests ./tests

# OMP_WAIT_POLICY: CTranslate2 decodes on OpenMP threads, and OpenMP defaults
# to ACTIVE - its worker threads busy-wait between parallel regions rather
# than sleeping. With intra_threads=2 that is two threads spinning at full
# speed for as long as the process lives, whether or not anything is being
# translated. On this two-core server it held the container at its own
# 1.5-CPU ceiling around the clock, starved the application that serves the
# site, and was the cause of the repeated 502s the public guard kept
# recovering from.
#
# Measured on the same image, the same model and the same mounted weights,
# with nothing queued: ACTIVE 150.63% CPU, PASSIVE 0.20%. PASSIVE changes
# only what an idle worker thread does while it waits - it sleeps instead of
# spinning - so decoding itself is untouched, and a same-backend batch
# measured within noise of the old setting.
ENV OMP_WAIT_POLICY=PASSIVE

USER svt
EXPOSE 5100

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5100/health', timeout=4)"

CMD ["uvicorn", "sv_translate.main:app", "--host", "0.0.0.0", "--port", "5100", "--workers", "1", "--no-access-log"]
