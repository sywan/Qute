"""A complete Qute-compatible server in one file, independent of qute_server.

pip install fastapi uvicorn python-multipart pillow
uvicorn minimal_server:app --port 8765        (run from this folder)
Replace `my_model()` with your own model. Protocol: docs/SERVER_API.md.
"""
import inspect
import io
import json

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageOps

app = FastAPI()
ALLOWED_ORIGINS = ["https://sywan.github.io", "http://localhost:5173", "http://localhost:4173"]


@app.middleware("http")
async def private_network_access(request: Request, call_next):
    response = await call_next(request)  # Chrome: HTTPS page -> localhost needs this header
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


cors = {"allow_origins": ALLOWED_ORIGINS, "allow_methods": ["GET", "POST", "OPTIONS"], "allow_headers": ["*"]}
if "allow_private_network" in inspect.signature(CORSMiddleware.__init__).parameters:  # newer Starlette
    cors["allow_private_network"] = True
app.add_middleware(CORSMiddleware, **cors)

ENGINES = [{
    "id": "my-invert",
    "available": True,
    "label": {"en": "Inverted colours (my model)", "zh-TW": "反相色彩（我的模型）"},
    "description": {"en": "Replace with your own model.", "zh-TW": "換成你自己的模型。"},
    "params": [{"name": "amount", "type": "number", "min": 0, "max": 1, "step": 0.1, "default": 1,
                "label": {"en": "Amount", "zh-TW": "程度"}}],
}]


def my_model(image, reference, params):
    inverted = ImageOps.invert(image)
    return Image.blend(image, inverted, float(params.get("amount", 1)))


@app.get("/api/health")
def health():
    return {"ok": True, "api": "qute-server/1"}


@app.get("/api/engines")
def engines():
    return {"engines": ENGINES}


@app.post("/api/stylize")
async def stylize(engine: str = Form(...), params: str = Form("{}"),
                  image: UploadFile = File(...), reference: UploadFile = File(None)):
    if engine != "my-invert":
        raise HTTPException(404, "unknown engine " + engine)
    photo = Image.open(io.BytesIO(await image.read())).convert("RGB")
    ref = Image.open(io.BytesIO(await reference.read())).convert("RGB") if reference else None
    result = my_model(photo, ref, json.loads(params or "{}"))
    buf = io.BytesIO()
    result.save(buf, format="PNG")
    return Response(buf.getvalue(), media_type="image/png")
