"""Forward an engine to another Qute worker process (same HTTP API).

Lets one gateway on port 8765 expose engines that live in different Python environments
(TensorFlow 2 for DCT-Net, TensorFlow 1.15 for WarpGAN) or on another machine.
"""
from __future__ import annotations

import io
import json
import time
import urllib.error
import urllib.request
import uuid

from PIL import Image

from .. import config
from .base import Engine, EngineUnavailable


def _multipart(fields: dict, files: dict):
    boundary = uuid.uuid4().hex
    out = io.BytesIO()
    for name, value in fields.items():
        out.write(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    for name, (filename, data, ctype) in files.items():
        out.write(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                  f"Content-Type: {ctype}\r\n\r\n".encode())
        out.write(data)
        out.write(b"\r\n")
    out.write(f"--{boundary}--\r\n".encode())
    return out.getvalue(), f"multipart/form-data; boundary={boundary}"


def _png(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


class RemoteEngine(Engine):
    def __init__(self, id: str, url: str, cache_seconds: float = 15):
        super().__init__(id=id)
        self.url = url.rstrip("/")
        self.cache_seconds = cache_seconds
        self._status = None
        self._checked = 0.0

    def _remote_info(self) -> dict:
        now = time.time()
        if self._status is not None and now - self._checked < self.cache_seconds:
            return self._status
        try:
            with urllib.request.urlopen(self.url + "/api/engines", timeout=3) as resp:
                engines = json.load(resp).get("engines", [])
            info = next((e for e in engines if e.get("id") == self.id), None)
            status = info or {"available": False, "reason": f"worker at {self.url} does not serve {self.id}"}
        except (urllib.error.URLError, OSError, ValueError) as exc:
            status = {"available": False, "reason": f"worker {self.url} unreachable: {exc}"}
        self._status, self._checked = status, now
        return status

    def check(self):
        info = self._remote_info()
        return bool(info.get("available")), info.get("reason", "")

    def available_variants(self):
        return self._remote_info().get("variants", [])

    def describe(self) -> dict:
        info = dict(self._remote_info())
        info.update({"id": self.id, "available": bool(info.get("available")), "remote": self.url})
        return info

    def warmup(self) -> None:
        req = urllib.request.Request(f"{self.url}/api/warmup?engine={self.id}", method="POST", data=b"")
        with urllib.request.urlopen(req, timeout=config.REMOTE_TIMEOUT):
            pass

    def run(self, image, reference, params):
        files = {"image": ("photo.png", _png(image), "image/png")}
        if reference is not None:
            files["reference"] = ("reference.png", _png(reference), "image/png")
        body, ctype = _multipart({"engine": self.id, "params": json.dumps(params)}, files)
        req = urllib.request.Request(self.url + "/api/stylize", data=body, headers={"Content-Type": ctype}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=config.REMOTE_TIMEOUT) as resp:
                return Image.open(io.BytesIO(resp.read())).convert("RGB")
        except urllib.error.HTTPError as exc:
            try:
                detail = json.load(exc).get("detail", "")
            except ValueError:
                detail = ""
            if exc.code == 503:
                raise EngineUnavailable(detail or "worker reports engine unavailable") from exc
            raise RuntimeError(f"worker error {exc.code}: {detail}") from exc
        except (urllib.error.URLError, OSError) as exc:
            self._status = None
            raise EngineUnavailable(f"worker {self.url} unreachable: {exc}") from exc
