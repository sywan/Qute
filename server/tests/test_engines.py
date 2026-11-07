"""Plumbing tests with stand-in upstream scripts and a real gateway -> worker hop."""
import io
import json
import os
import socket
import subprocess
import sys
import textwrap
import time
import urllib.request
from pathlib import Path

import pytest
from PIL import Image

SERVER = Path(__file__).resolve().parents[1]


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start(env_extra, port):
    env = dict(os.environ, QUTE_ENV_FILE="/nonexistent", PYTHONPATH=str(SERVER), **env_extra)
    proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "qute_server.app:app", "--port", str(port)],
                            cwd=str(SERVER), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        try:
            urllib.request.urlopen("http://127.0.0.1:{}/api/health".format(port), timeout=1)
            return proc
        except OSError:
            time.sleep(0.1)
    proc.kill()
    raise RuntimeError("server did not start")


def engines(port):
    with urllib.request.urlopen("http://127.0.0.1:{}/api/engines".format(port)) as r:
        return {e["id"]: e for e in json.load(r)["engines"]}


def stylize(port, engine, params=None):
    from qute_server.engines.remote import _multipart

    buf = io.BytesIO()
    Image.new("RGB", (80, 60), (10, 200, 30)).save(buf, format="PNG")
    body, ctype = _multipart({"engine": engine, "params": json.dumps(params or {})}, {"image": ("a.png", buf.getvalue(), "image/png")})
    req = urllib.request.Request("http://127.0.0.1:{}/api/stylize".format(port), data=body, headers={"Content-Type": ctype})
    with urllib.request.urlopen(req, timeout=60) as r:
        return Image.open(io.BytesIO(r.read()))


@pytest.fixture
def fake_repos(tmp_path):
    vt = tmp_path / "VToonify"
    (vt / "checkpoint" / "vtoonify_d_pixar").mkdir(parents=True)
    for f in ("encoder.pt", "faceparsing.pth", "shape_predictor_68_face_landmarks.dat"):
        (vt / "checkpoint" / f).write_bytes(b"x")
    (vt / "checkpoint" / "vtoonify_d_pixar" / "vtoonify_s_d.pt").write_bytes(b"x")
    # Stand-in for style_transfer.py: records its arguments and writes the two images the real script writes.
    (vt / "style_transfer.py").write_text(textwrap.dedent("""
        import sys, json
        from PIL import Image
        a = sys.argv[1:]
        out = a[a.index('--output_path') + 1]
        Image.new('RGB', (10, 10), 'white').save(out + 'photo_input.jpg')
        Image.new('RGB', (32, 48), 'red').save(out + 'photo_vtoonify_d.jpg')
        open(out + 'args.json', 'w').write(json.dumps(a))
    """))
    wg = tmp_path / "WarpGAN"
    (wg / "pretrained" / "warpgan_pretrained").mkdir(parents=True)
    (wg / "test.py").write_text(textwrap.dedent("""
        import sys
        from PIL import Image
        model, inp, out = sys.argv[1:4]
        assert '--scale' in sys.argv
        Image.new('RGB', (256, 256), 'blue').save(out + '_0.jpg')
    """))
    return {"VTOONIFY_DIR": str(vt), "VTOONIFY_DEVICE": "cpu", "WARPGAN_DIR": str(wg),
            "WARPGAN_MODEL": str(wg / "pretrained" / "warpgan_pretrained")}


def test_subprocess_engines_and_gateway(fake_repos):
    worker_port, gateway_port = free_port(), free_port()
    worker = start(dict(fake_repos, QUTE_ENGINES="vtoonify,warpgan"), worker_port)
    gateway = start({"QUTE_ENGINES": "server-whitebox",
                     "QUTE_REMOTE_ENGINES": "vtoonify=http://127.0.0.1:{0},warpgan=http://127.0.0.1:{0},dctnet=http://127.0.0.1:9".format(worker_port)},
                    gateway_port)
    try:
        w = engines(worker_port)
        assert set(w) == {"vtoonify", "warpgan"}
        assert w["vtoonify"]["available"] and w["vtoonify"]["variants"] == ["pixar"]
        g = engines(gateway_port)
        assert g["vtoonify"]["available"] and g["vtoonify"]["remote"].endswith(str(worker_port))
        assert g["warpgan"]["available"]
        assert not g["dctnet"]["available"] and "unreachable" in g["dctnet"]["reason"]
        assert g["server-whitebox"]["available"]
        assert "instantid-chibi" not in g
        # Result picks the stylised file, not the rescaled input the script also writes.
        assert stylize(gateway_port, "vtoonify", {"variant": "cartoon", "style_degree": 0.3}).size == (32, 48)
        assert stylize(gateway_port, "warpgan", {"exaggeration": 1.5}).size == (256, 256)
        assert stylize(gateway_port, "server-whitebox").size == (80, 60)
    finally:
        gateway.terminate()
        worker.terminate()
