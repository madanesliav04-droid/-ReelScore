#!/usr/bin/env bash
set -euo pipefail
# Execute only on the native ARM64 machine. Input stays private and read-only.
if [[ $(uname -m) != aarch64 && $(uname -m) != arm64 ]]; then
  echo 'Native ARM64 host required; QEMU timings are not Oracle A1 timings.' >&2; exit 1
fi
if [[ $# != 3 ]]; then echo 'Usage: benchmark.sh IMAGE PRIVATE_RUSH NEW_PRIVATE_OUTPUT_DIR' >&2; exit 1; fi
image=$1
rush=$(realpath "$2")
output=$(realpath -m "$3")
[[ -f "$rush" && ! -e "$output" ]] || { echo 'Rush missing or output already exists.' >&2; exit 1; }
[[ $(docker image inspect --format '{{.Architecture}}' "$image") == arm64 ]] || exit 1
install -d -m 0700 "$output"
runner=$(realpath "$(dirname "$0")/benchmark.mjs")
# No credentials, no remote media, no networking, one render only. The four ASR
# threads are existing engine settings; the cgroup enforces the 2-CPU envelope.
container_id=$(docker create --platform linux/arm64 --network none --cpus 2 --memory 8g --memory-swap 8g \
  --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges \
  --mount "type=bind,src=$rush,dst=/input/rush.mov,readonly" \
  --mount "type=bind,src=$output,dst=/output" \
  --mount "type=bind,src=$runner,dst=/benchmark.mjs,readonly" \
  "$image" node /benchmark.mjs)
# Only this newly-created container is removed. Keep its exit/OOM evidence even
# when the kernel kills the renderer before JavaScript can write its metrics.
trap 'docker rm -f "$container_id" >/dev/null 2>&1 || true' EXIT
status=0
docker start -a "$container_id" >"$output/runtime.log" 2>&1 || status=$?
docker inspect --format '{{json .State}}' "$container_id" >"$output/container-state.json"
docker image inspect --format '{{.Size}}' "$image" >"$output/image-bytes.txt"
du -sb "$output" >"$output/workspace-bytes.txt"
if [[ $status != 0 ]]; then echo "Benchmark failed ($status); private logs and OOM state: $output" >&2; exit "$status"; fi
echo "Private results: $output/benchmark.json and $output/alex.mp4"
