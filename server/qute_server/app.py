"""Qute self-hosted inference server (gateway or worker).

Run:  uvicorn qute_server.app:app --host 127.0.0.1 --port 8765
API:  GET  /api/health
      GET  /api/engines   -> {"engines": [{"id", "available", "reason"?, "variants"?, "remote"?}]}
      POST /api/warmup?engine=ID      load an engine's weights ahead of the first request
      POST /api/stylize   multipart: engine, params (JSON), image, reference? -> image/png
Photos are processed in memory; temporary files used by subprocess engines are deleted when
a request finishes. Python 3.7+ (the WarpGAN worker runs on TensorFlow 1.15).
"""
from __future__ import annotations

import inspect
import io
import json
import logging
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageOps

from . import config
from .engines import ENGINES, EngineUnavailable

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("qute")
app = FastAPI(title="Qute inference server", version="0.4.0")


@app.middleware("http")
async def private_network_access(request: Request, call_next):
    # Chrome's Private Network Access: an HTTPS page (GitHub Pages) calling localhost/LAN
    # sends a preflight with this header and requires the matching response header.
    response = await call_next(request)
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


_cors = {"allow_origins": config.ALLOWED_ORIGINS, "allow_methods": ["GET", "POST", "OPTIONS"], "allow_headers": ["*"], "max_age": 600}
if "allow_private_network" in inspect.signature(CORSMiddleware.__init__).parameters:  # Starlette >= 0.45
    _cors["allow_private_network"] = True
app.add_middleware(CORSMiddleware, **_cors)


async def _read_image(upload: Optional[UploadFile]):
    if upload is None:
        return None
    data = await upload.read()
    if len(data) > config.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, "image larger than {:g} MB".format(config.MAX_UPLOAD_MB))
    try:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, "unreadable image") from exc
    image.thumbnail((config.MAX_SIDE, config.MAX_SIDE), Image.LANCZOS)
    return image


@app.on_event("startup")
def report_engines():
    for engine in ENGINES.values():
        info = engine.describe()
        log.info("engine %-16s %s %s", info["id"], "READY" if info["available"] else "off  ", info.get("reason", info.get("remote", "")))


@app.get("/api/health")
def health():
    return {"ok": True, "version": app.version}


@app.get("/api/engines")
def list_engines():
    return {"engines": [engine.describe() for engine in ENGINES.values()]}


@app.post("/api/warmup")
async def warmup(engine: str):
    if engine not in ENGINES:
        raise HTTPException(404, "unknown engine " + engine)
    try:
        await run_in_threadpool(ENGINES[engine].warmup)
    except EngineUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    return {"ok": True, "engine": engine}


@app.post("/api/stylize")
async def stylize(
    engine: str = Form(...),
    params: str = Form("{}"),
    image: UploadFile = File(...),
    reference: Optional[UploadFile] = File(None),
):
    if engine not in ENGINES:
        raise HTTPException(404, "unknown engine " + engine)
    try:
        options = json.loads(params or "{}")
        if not isinstance(options, dict):
            raise ValueError
    except ValueError as exc:
        raise HTTPException(400, "params must be a JSON object") from exc
    photo = await _read_image(image)
    ref = await _read_image(reference)
    try:
        result = await run_in_threadpool(ENGINES[engine].run, photo, ref, options)
    except EngineUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        log.exception("engine %s failed", engine)
        raise HTTPException(500, "{} failed: {}".format(engine, exc)) from exc
    buffer = io.BytesIO()
    result.save(buffer, format="PNG")
    return Response(buffer.getvalue(), media_type="image/png", headers={"Cache-Control": "no-store"})
