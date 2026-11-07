"""White-box Cartoonization (Wang & Yu, CVPR 2020) run with ONNX Runtime.

Uses the same ONNX file the web app serves (converted from the official TF checkpoint, see
scripts/convert_whitebox.py), so browser and server results match.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from .. import config
from .base import Engine, has_module


class OnnxCartoonEngine(Engine):
    def __init__(self, id: str, filename: str, multiple: int = 8):
        super().__init__(id=id)
        self.filename = filename
        self.multiple = multiple

    @property
    def path(self):
        return config.MODELS_DIR / self.filename if config.MODELS_DIR else None

    def check(self):
        ok, reason = has_module("onnxruntime")
        if not ok:
            return ok, reason
        if not self.path or not self.path.exists():
            return False, f"model file not found: {self.path}"
        return True, ""

    def load(self):
        import onnxruntime as ort

        providers = [p for p in ("CUDAExecutionProvider", "CoreMLExecutionProvider", "CPUExecutionProvider")
                     if p in ort.get_available_providers()]
        return ort.InferenceSession(str(self.path), providers=providers)

    def infer(self, session, image, reference, params):
        w, h = image.size
        m = self.multiple
        tw, th = max(m, w - w % m), max(m, h - h % m)
        x = np.asarray(image.convert("RGB").resize((tw, th), Image.LANCZOS), dtype=np.float32) / 127.5 - 1
        out = session.run(None, {session.get_inputs()[0].name: x[None]})[0][0]
        out = np.clip((out + 1) * 127.5, 0, 255).astype(np.uint8)
        return Image.fromarray(out).resize((w, h), Image.LANCZOS)
