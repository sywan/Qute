#!/usr/bin/env bash
# Start the Qute server on a Mac: DCT-Net worker on :8766 (TensorFlow venv) and the gateway on
# :8765 (White-box, InstantID chibi, VToonify; forwards DCT-Net and optional WarpGAN).
# Stop with Ctrl-C. In Qute → Advanced → Your server URL: http://localhost:8765
set -euo pipefail

SERVER="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$SERVER"
[ -x .venv-main/bin/python ] || { echo "Run ./deploy/mac/setup.sh first."; exit 1; }
mkdir -p logs
export PYTORCH_ENABLE_MPS_FALLBACK=1 TOKENIZERS_PARALLELISM=false

WORKER_PID=""
cleanup() { [ -n "$WORKER_PID" ] && kill "$WORKER_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

if [ -x .venv-dctnet/bin/python ]; then
  echo "[qute] starting DCT-Net worker on 127.0.0.1:8766 (log: server/logs/dctnet.log)"
  QUTE_ENGINES=dctnet QUTE_REMOTE_ENGINES='' .venv-dctnet/bin/python -m uvicorn qute_server.app:app \
    --host 127.0.0.1 --port 8766 > logs/dctnet.log 2>&1 &
  WORKER_PID=$!
fi

echo "[qute] starting gateway on 127.0.0.1:8765"
QUTE_ENGINES="${QUTE_ENGINES:-server-whitebox,instantid-chibi,vtoonify}" \
  .venv-main/bin/python -m uvicorn qute_server.app:app --host 127.0.0.1 --port 8765
