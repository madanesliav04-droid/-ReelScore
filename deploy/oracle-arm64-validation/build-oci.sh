#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ $# == 1 ]] || { echo 'Usage: build-oci.sh NEW_OUTPUT.oci.tar' >&2; exit 1; }
output=$(realpath -m "$1")
[[ ! -e "$output" && -d $(dirname "$output") ]] || { echo 'Output must be new; parent directory must exist.' >&2; exit 1; }
available=$(df -PB1 "$(dirname "$output")" | awk 'NR==2 {print $4}')
[[ $available -ge 6442450944 ]] || { echo 'At least 6 GiB free required for this bounded OCI export. No build started.' >&2; exit 1; }
# No --load: avoid the extra Docker daemon import and vfs layer duplication.
# This is not a registry push and does not start a worker or cloud resource.
docker buildx build --platform linux/arm64 --provenance=false \
  -f deploy/oracle-arm64-validation/Dockerfile \
  --tag socialplus-alex:oracle-arm64 --output "type=oci,dest=$output" .
python3 deploy/oracle-arm64-validation/verify-oci.py "$output" >"$output.verification.json"
sha256sum "$output" >"$output.sha256"
echo "Verified local OCI archive: $output"
