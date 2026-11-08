import io
import json

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from qute_server import config
from qute_server.app import app
from qute_server.engines.instantid import chibi_keypoints

client = TestClient(app)


def png(w=96, h=64, color=(200, 120, 60)):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, format="PNG")
    return buf.getvalue()


def test_engines_listed_with_availability():
    body = client.get("/api/engines").json()
    ids = {e["id"]: e for e in body["engines"]}
    assert {"dctnet", "vtoonify", "instantid-chibi", "warpgan", "server-whitebox"} <= set(ids)
    assert ids["dctnet"]["variants"] == ["anime", "3d", "handdrawn", "sketch", "artstyle"]
    assert ids["server-whitebox"]["available"] is (config.MODELS_DIR / "whitebox-cartoon.onnx").exists()


def test_whitebox_round_trip_keeps_size():
    r = client.post("/api/stylize", data={"engine": "server-whitebox", "params": "{}"}, files={"image": ("a.png", png(), "image/png")})
    assert r.status_code == 200, r.text
    assert Image.open(io.BytesIO(r.content)).size == (96, 64)


def test_unavailable_engine_returns_503_and_reason():
    r = client.post("/api/stylize", data={"engine": "vtoonify", "params": json.dumps({"style_degree": 0.5})}, files={"image": ("a.png", png(), "image/png")})
    assert r.status_code == 503
    assert "VTOONIFY_DIR" in r.json()["detail"]


def test_bad_requests():
    assert client.post("/api/stylize", data={"engine": "nope"}, files={"image": ("a.png", png(), "image/png")}).status_code == 404
    assert client.post("/api/stylize", data={"engine": "server-whitebox", "params": "[1]"}, files={"image": ("a.png", png(), "image/png")}).status_code == 400
    assert client.post("/api/stylize", data={"engine": "server-whitebox"}, files={"image": ("a.txt", b"hello", "text/plain")}).status_code == 400


def test_cors_and_private_network_preflight():
    r = client.options("/api/stylize", headers={
        "Origin": "https://sywan.github.io", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Private-Network": "true"})
    assert r.headers.get("access-control-allow-origin") == "https://sywan.github.io"
    assert r.headers.get("access-control-allow-private-network") == "true"
    r = client.options("/api/stylize", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert r.headers.get("access-control-allow-origin") is None


def test_chibi_keypoints_layout():
    kps = np.array([[100, 100], [140, 100], [120, 120], [105, 140], [135, 140]], dtype=np.float32)
    out = chibi_keypoints(kps, 896, 1152, 0.4)
    assert abs(out.mean(axis=0)[0] - 448) < 1e-3 and abs(out.mean(axis=0)[1] - 1152 * 0.30) < 1e-3
    assert abs(np.linalg.norm(out[1] - out[0]) - 0.4 * 896 * 0.42) < 1e-3


def test_root_status_page_lists_engines():
    r = client.get("/")
    assert r.status_code == 200 and "text/html" in r.headers["content-type"]
    assert "Qute server" in r.text and "server-whitebox" in r.text and "VTOONIFY_DIR" in r.text
