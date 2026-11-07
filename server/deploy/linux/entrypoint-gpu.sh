#!/bin/sh
# Download missing weights into the /data volume, then start the gateway.
set -e
cd /opt/qute/server
mkdir -p /data/vtoonify/checkpoint /data/instantid /data/insightface /data/hf
if [ "${QUTE_SKIP_FETCH:-0}" != "1" ]; then
  python scripts/fetch_models.py vtoonify --vtoonify-dir /data/vtoonify --styles "${VTOONIFY_FETCH_STYLES:-cartoon,comic,arcane,pixar}"
  python scripts/fetch_models.py instantid --dest /data/instantid
  python scripts/fetch_models.py antelopev2 --root /data/insightface
  python scripts/fetch_models.py sdxl --repo "${INSTANTID_BASE_MODEL:-stabilityai/stable-diffusion-xl-base-1.0}"
  if [ "${INSTANTID_LCM:-0}" = "1" ]; then python scripts/fetch_models.py lcm; fi
fi
if [ -n "${CHIBI_LORA:-}" ] && [ ! -e "${CHIBI_LORA}" ] && [ "${CHIBI_LORA%.safetensors}" != "${CHIBI_LORA}" ]; then
  echo "[qute] WARNING: CHIBI_LORA=${CHIBI_LORA} not found; put your LoRA in server/deploy/linux/loras/ (mounted at /loras)."
fi
exec python -m uvicorn qute_server.app:app --host 0.0.0.0 --port 8765
