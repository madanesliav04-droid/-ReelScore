FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates ffmpeg \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0 \
  libx11-xcb1 libxshmfence1 fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
RUN npx remotion browser ensure

COPY src ./src
COPY remotion ./remotion

ENV NODE_ENV=production
ENV REMOTION_CONCURRENCY=2
CMD ["npm","start"]
