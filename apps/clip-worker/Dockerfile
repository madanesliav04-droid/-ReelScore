FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates ffmpeg python3 python3-pip fonts-liberation \
  && python3 -m pip install --break-system-packages --no-cache-dir yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/clip-worker/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY apps/clip-worker/src ./src
COPY apps/worker/src/viral.js ./src/viral.js

ENV NODE_ENV=production
CMD ["npm","start"]
