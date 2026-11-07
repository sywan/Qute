#!/usr/bin/env bash
# Optional: run the WarpGAN worker on a Mac with Docker Desktop (x86-64 emulation, port 8767).
# TensorFlow 1.15 has no Apple Silicon build, so this uses Rosetta; if it fails with
# "illegal instruction", run WarpGAN on the Linux GPU box instead and point QUTE_REMOTE_ENGINES at it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DATA="$ROOT/server/data"
mkdir -p "$DATA/warpgan"
docker build --platform linux/amd64 -f "$ROOT/server/deploy/linux/Dockerfile.warpgan" -t qute-server-warpgan:0.4 "$ROOT"
docker rm -f qute-warpgan >/dev/null 2>&1 || true
docker run -d --name qute-warpgan --platform linux/amd64 --restart unless-stopped \
  -p 127.0.0.1:8767:8765 -v "$DATA:/data" qute-server-warpgan:0.4
echo "WarpGAN worker on http://127.0.0.1:8767 — add ',warpgan=http://127.0.0.1:8767' to QUTE_REMOTE_ENGINES in server/.env and restart run.sh."
