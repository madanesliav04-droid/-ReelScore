# Build from the repository root. No app credentials, data or npm dependencies
# enter this image. Build/run this image only on an explicitly selected machine.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/apps/socialplus
COPY --chown=node:node apps/worker/package.json /app/apps/worker/package.json
COPY --chown=node:node apps/worker/src /app/apps/worker/src
COPY --chown=node:node apps/socialplus/package.json ./package.json
COPY --chown=node:node apps/socialplus/server ./server
COPY --chown=node:node apps/socialplus/public ./public
COPY --chown=node:node apps/socialplus/scripts ./scripts
RUN mkdir -p /data && chown -R node:node /data /app/apps/socialplus
USER node
ENV NODE_ENV=production SOCIALPLUS_HOST=0.0.0.0 PORT=4318 SOCIALPLUS_DATA_DIR=/data
EXPOSE 4318
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
