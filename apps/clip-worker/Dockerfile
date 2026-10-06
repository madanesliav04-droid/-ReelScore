FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates ffmpeg python3 python3-pip fonts-liberation git \
  && python3 -m pip install --break-system-packages --no-cache-dir yt-dlp bgutil-ytdlp-pot-provider==2.0.0 \
  && git clone --depth 1 --branch 2.0.0 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil-ytdlp-pot-provider \
  && cd /opt/bgutil-ytdlp-pot-provider/server \
  && npm ci --no-audit --no-fund \
  && npx tsc \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/clip-worker/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY apps/clip-worker/src ./src
COPY apps/worker/src/viral.js ./src/viral.js

ENV NODE_ENV=production
CMD ["sh","-c","node /opt/bgutil-ytdlp-pot-provider/server/build/main.js --host 127.0.0.1 --port 4416 >/tmp/pot-provider.log 2>&1 & exec node src/index.js"]
