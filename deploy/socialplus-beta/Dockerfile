# Dedicated deployment image, no changes to an artistic engine or production image.
# Build context MUST be the repository root. CPU only; no GPU or external AI API.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/socialplus-asr
COPY apps/worker/reconstruction/alex-v16/requirements.txt /tmp/alex-requirements.txt
RUN /opt/socialplus-asr/bin/pip install --no-cache-dir -r /tmp/alex-requirements.txt
COPY deploy/socialplus-beta/model-manifest.json deploy/socialplus-beta/fetch-model.py /opt/model-bootstrap/
RUN python3 /opt/model-bootstrap/fetch-model.py
WORKDIR /app
COPY --chown=node:node apps/worker/package.json apps/worker/package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node apps/worker/src ./src
COPY --chown=node:node apps/worker/remotion ./remotion
COPY --chown=node:node apps/worker/reconstruction ./reconstruction
# Chromium is not downloaded: Alex V16's existing path uses Python/Pillow/FFmpeg.
# The runtime admission gate prevents all other render paths from being invoked.
ENV NODE_ENV=production SOCIALPLUS_ALEX_ONLY=true ALEX_V16_RECONSTRUCTION_ENABLED=true ALEX_V16_REVIEW_DRAFTS=true SOCIALPLUS_PYTHON=/opt/socialplus-asr/bin/python SOCIALPLUS_ASR_MODEL_DIR=/opt/models/whisper-small HF_HUB_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1
USER node
CMD ["node","src/index.js"]
