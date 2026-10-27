# Compatibility image only. No upload, deployment or artistic engine change.
# One install layer avoids duplicating large native snapshots in a constrained
# QEMU builder. Production image optimization is a separate approval.
FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
WORKDIR /app
COPY --chown=node:node apps/worker/package.json apps/worker/package-lock.json ./
COPY --chown=node:node apps/worker/src ./src
COPY --chown=node:node apps/worker/remotion ./remotion
COPY --chown=node:node apps/worker/reconstruction ./reconstruction
COPY deploy/socialplus-beta/model-manifest.json deploy/socialplus-beta/fetch-model.py /opt/model-bootstrap/
ENV NODE_ENV=production SOCIALPLUS_ALEX_ONLY=true ALEX_V16_RECONSTRUCTION_ENABLED=true ALEX_V16_REVIEW_DRAFTS=true SOCIALPLUS_PYTHON=/opt/socialplus-asr/bin/python SOCIALPLUS_ASR_MODEL_DIR=/opt/models/whisper-small HF_HUB_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates \
 && python3 -m venv /opt/socialplus-asr \
 && /opt/socialplus-asr/bin/pip install --no-cache-dir -r reconstruction/alex-v16/requirements.txt \
 && npm ci --omit=dev \
 && python3 /opt/model-bootstrap/fetch-model.py \
 && /opt/socialplus-asr/bin/python -c "import platform, PIL, numpy, faster_whisper, ctranslate2, onnxruntime, av; assert platform.machine() in ('aarch64','arm64'); print('ARM64_NATIVE_IMPORTS_OK')" \
 && node --input-type=module -e "import('./src/alex-v16-pipeline.js').then(()=>{if(process.arch!=='arm64')process.exit(1); console.log('ARM64_ALEX_REMOTION_IMPORT_OK')})" \
 && su node -s /bin/sh -c 'node src/alex-v16-pipeline.js && echo ARM64_NONROOT_IMPORT_OK' \
 && /opt/socialplus-asr/bin/python -m unittest discover -s reconstruction/alex-v16 -p test_reconstruction.py \
 && ffmpeg -v error -f lavfi -i testsrc2=size=320x180:rate=25 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 1 -c:v libx264 -pix_fmt yuv420p -c:a aac /tmp/arm64-smoke.mp4 \
 && ffmpeg -v error -i /tmp/arm64-smoke.mp4 -f null - \
 && ffprobe -v error -show_entries stream=codec_name,width,height -of json /tmp/arm64-smoke.mp4 \
 && rm /tmp/arm64-smoke.mp4 \
 && rm -rf /var/lib/apt/lists/*
# COPY ownership avoids a second large chown layer. Whisper inference was
# already tested in emulation; use benchmark.sh on native ARM64 for the actual
# spoken-rush inference instead of repeating synthetic QEMU inference at build.
USER node
CMD ["node","src/index.js"]
