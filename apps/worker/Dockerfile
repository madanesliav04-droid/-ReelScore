FROM node:22-bookworm-slim

# Explicit opt-in image variant only; no model weights are downloaded in builds.
ARG ENABLE_ALEX_OFFLINE=0
RUN if [ "$ENABLE_ALEX_OFFLINE" = "1" ]; then \
  apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && \
  python3 -m venv /opt/socialplus-asr && \
  /opt/socialplus-asr/bin/pip install --no-cache-dir Pillow==12.3.0 numpy==2.3.5 faster-whisper==1.2.1 && \
  rm -rf /var/lib/apt/lists/*; fi

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates ffmpeg \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0 \
  libx11-xcb1 libxshmfence1 fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
RUN npx remotion browser ensure

COPY src ./src
COPY remotion ./remotion
COPY tests ./tests
COPY references ./references
COPY reconstruction ./reconstruction
RUN npm run check && npm test && node --input-type=module -e "import path from 'node:path'; import {bundle} from '@remotion/bundler'; await bundle({entryPoint:path.resolve('remotion/index.jsx')});"

ENV NODE_ENV=production
ENV REMOTION_CONCURRENCY=2
ENV SOCIALPLUS_PYTHON=/opt/socialplus-asr/bin/python
CMD ["npm","start"]
