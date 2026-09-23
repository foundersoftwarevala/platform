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

USER svt
EXPOSE 5100

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5100/health', timeout=4)"

CMD ["uvicorn", "sv_translate.main:app", "--host", "0.0.0.0", "--port", "5100", "--workers", "1", "--no-access-log"]
