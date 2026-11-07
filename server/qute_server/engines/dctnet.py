"""DCT-Net: Domain-Calibrated Translation for Portrait Stylization (Men et al., ACM TOG 2022).

Runs the official ModelScope pipelines (https://github.com/menyifang/DCT-Net). Weights are
downloaded by ModelScope on first use into its cache (~/.cache/modelscope).
"""
from __future__ import annotations

import tempfile

import numpy as np
from PIL import Image

from .. import config
from .base import Engine, has_module

# Multiple faces are handled by the pipeline itself (it stylises every detected head).

MODELS = {
    "anime": "damo/cv_unet_person-image-cartoon_compound-models",
    "3d": "damo/cv_unet_person-image-cartoon-3d_compound-models",
    "handdrawn": "damo/cv_unet_person-image-cartoon-handdrawn_compound-models",
    "sketch": "damo/cv_unet_person-image-cartoon-sketch_compound-models",
    "artstyle": "damo/cv_unet_person-image-cartoon-artstyle_compound-models",
}


class DCTNetEngine(Engine):
    def __init__(self):
        super().__init__(id="dctnet", variants=list(MODELS))
        self._pipelines: dict = {}

    def check(self):
        if not config.DCTNET_ENABLED:
            return False, "disabled (DCTNET_ENABLED=0)"
        return has_module("modelscope", "tensorflow", "cv2")

    def infer(self, _model, image, reference, params):
        from modelscope.outputs import OutputKeys
        from modelscope.pipelines import pipeline
        from modelscope.utils.constant import Tasks

        variant = params.get("variant") or "anime"
        if variant not in MODELS:
            variant = "anime"
        if variant not in self._pipelines:
            model_id = MODELS[variant]
            try:
                self._pipelines[variant] = pipeline(Tasks.image_portrait_stylization, model=model_id)
            except Exception:  # noqa: BLE001 — ModelScope moved DAMO models to the "iic" namespace
                self._pipelines[variant] = pipeline(Tasks.image_portrait_stylization, model=model_id.replace("damo/", "iic/"))
        with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
            image.convert("RGB").save(tmp.name)
            result = self._pipelines[variant](tmp.name)
        bgr = result[OutputKeys.OUTPUT_IMG]
        return Image.fromarray(np.ascontiguousarray(np.clip(bgr[:, :, ::-1], 0, 255)).astype(np.uint8))
