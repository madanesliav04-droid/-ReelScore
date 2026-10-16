FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates ffmpeg chromium fonts-liberation fonts-dejavu-core fonts-noto-core \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    CHROME_PATH=/usr/bin/chromium \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    HYPERFRAMES_BROWSER_PATH=/usr/bin/chromium
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY hyperframes ./hyperframes
# Expose the HyperFrames CLI through the worker's local node_modules/.bin.
# No production render route is changed until a full E2E test passes.

ENV NODE_ENV=production
CMD ["node","src/index.js"]
