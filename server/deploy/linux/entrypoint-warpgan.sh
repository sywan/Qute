#!/bin/sh
# Fetch the WarpGAN pretrained model (Google Drive) into /data once, then start the worker.
set -e
cd /opt/qute/server
if [ -z "${WARPGAN_MODEL:-}" ]; then
  if python scripts/fetch_models.py warpgan --dest /data/warpgan > /tmp/warpgan-fetch.log 2>&1; then
    WARPGAN_MODEL=$(tail -n 1 /tmp/warpgan-fetch.log)
  else
    cat /tmp/warpgan-fetch.log
    echo "[qute] WarpGAN model download failed. Download it from the Google Drive link in the WarpGAN README,"
    echo "       unzip it into server/deploy/linux/data/warpgan/ and restart: docker compose restart warpgan"
    WARPGAN_MODEL=/data/warpgan/missing
  fi
  export WARPGAN_MODEL
fi
echo "[qute] WARPGAN_MODEL=${WARPGAN_MODEL}"
exec python -m uvicorn qute_server.app:app --host 0.0.0.0 --port 8765
