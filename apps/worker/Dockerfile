FROM node:22-bookworm-slim

# Existing native Edit+ / Viral+ pipeline and optional HyperFrames Chromium renderer.
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates ffmpeg fonts-liberation fonts-dejavu-core fonts-noto-core \
  libnss3 libgbm1 libasound2 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libxkbcommon0 libpango-1.0-0 libcairo2 libx11-xcb1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
ENV HYPERFRAMES_NO_UPDATE_CHECK=1
RUN npm install --omit=dev --no-audit --no-fund \
  && ./node_modules/.bin/hyperframes browser ensure

COPY src ./src

ENV NODE_ENV=production
# Existing FFmpeg render path remains the default.
# HyperFrames must be explicitly enabled by a later integration: ENABLE_HYPERFRAMES_RENDER=true.
CMD ["node","src/index.js"]
