"""True chibi redraw: SDXL + InstantID (identity) + a chibi-style LoRA.

InstantID: Wang et al., arXiv:2401.07519 (2024), https://github.com/InstantID/InstantID
IP-Adapter: Ye et al., arXiv:2308.06721 (2023)

The face keypoints are re-drawn into a chibi composition (large head in the upper part of a
portrait canvas) so ControlNet steers the model toward big-head / small-body proportions,
while the ArcFace identity embedding keeps the person recognisable.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

from .. import config
from .base import Engine, has_module


def chibi_keypoints(kps, width: int = 896, height: int = 1152, head_ratio: float = 0.40):
    """Re-centre five facial keypoints so the face spans `head_ratio` of the canvas width,
    centred horizontally and placed in the upper third (two-head-tall chibi layout)."""
    kps = np.asarray(kps, dtype=np.float32)
    center = kps.mean(axis=0)
    eye_dist = float(np.linalg.norm(kps[1] - kps[0])) or 1.0
    # Eye distance is roughly 0.42 of face width.
    scale = (head_ratio * width * 0.42) / eye_dist
    target = np.array([width / 2, height * 0.30], dtype=np.float32)
    return (kps - center) * scale + target


class InstantIDChibiEngine(Engine):
    def __init__(self):
        super().__init__(id="instantid-chibi")

    def check(self):
        ok, reason = has_module("torch", "diffusers", "insightface", "cv2")
        if not ok:
            return ok, reason
        if not config.INSTANTID_DIR or not (config.INSTANTID_DIR / "pipeline_stable_diffusion_xl_instantid.py").exists():
            return False, "set INSTANTID_DIR to a clone of InstantID/InstantID"
        ck = config.INSTANTID_CHECKPOINTS
        if not ck or not (ck / "ControlNetModel").exists() or not (ck / "ip-adapter.bin").exists():
            return False, "set INSTANTID_CHECKPOINTS (run scripts/fetch_models.py instantid)"
        if not config.INSIGHTFACE_ROOT or not (config.INSIGHTFACE_ROOT / "models" / "antelopev2").exists():
            return False, "set INSIGHTFACE_ROOT to a folder containing models/antelopev2 (run scripts/fetch_models.py antelopev2)"
        return True, ""

    @staticmethod
    def lora_source():
        """The chibi LoRA to load, or None (local file missing / not configured -> prompt only)."""
        if not config.CHIBI_LORA:
            return None
        if config.CHIBI_LORA.endswith(".safetensors"):
            path = Path(config.CHIBI_LORA).expanduser()
            return str(path) if path.exists() else None
        return config.CHIBI_LORA  # Hugging Face repo id

    def describe(self):
        info = super().describe()
        if info["available"] and not self.lora_source():
            info["note"] = "no chibi LoRA found (CHIBI_LORA); running with prompt + keypoint layout only"
        return info

    def load(self):
        import torch
        from diffusers.models import ControlNetModel
        from insightface.app import FaceAnalysis

        sys.path.insert(0, str(config.INSTANTID_DIR))
        from pipeline_stable_diffusion_xl_instantid import StableDiffusionXLInstantIDPipeline, draw_kps  # noqa: E402

        device = config.DEVICE
        dtype = torch.float16 if device in ("cuda", "mps") else torch.float32
        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if device == "cuda" else ["CPUExecutionProvider"]
        face_app = FaceAnalysis(name="antelopev2", root=str(config.INSIGHTFACE_ROOT), providers=providers)
        face_app.prepare(ctx_id=0 if device == "cuda" else -1, det_size=(640, 640))

        controlnet = ControlNetModel.from_pretrained(str(config.INSTANTID_CHECKPOINTS / "ControlNetModel"), torch_dtype=dtype)
        kwargs = {"variant": config.INSTANTID_VARIANT} if config.INSTANTID_VARIANT and dtype == torch.float16 else {}
        pipe = StableDiffusionXLInstantIDPipeline.from_pretrained(
            config.INSTANTID_BASE_MODEL, controlnet=controlnet, torch_dtype=dtype, **kwargs)
        if device == "cuda" and config.INSTANTID_CPU_OFFLOAD:
            pipe.enable_model_cpu_offload()
        else:
            pipe.to(device)
        if device == "mps":
            pipe.enable_attention_slicing()
        pipe.enable_vae_tiling()
        pipe.load_ip_adapter_instantid(str(config.INSTANTID_CHECKPOINTS / "ip-adapter.bin"))

        adapters, weights = [], []
        source = self.lora_source()
        if source:
            lora_kwargs = {"weight_name": config.CHIBI_LORA_WEIGHT_NAME} if config.CHIBI_LORA_WEIGHT_NAME else {}
            pipe.load_lora_weights(source, adapter_name="chibi", **lora_kwargs)
            adapters.append("chibi")
            weights.append(config.CHIBI_LORA_SCALE)
        if config.INSTANTID_LCM:
            from diffusers import LCMScheduler

            pipe.load_lora_weights(config.INSTANTID_LCM_LORA, adapter_name="lcm")
            pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
            adapters.append("lcm")
            weights.append(1.0)
        if adapters:
            pipe.set_adapters(adapters, adapter_weights=weights)
        return {"pipe": pipe, "face_app": face_app, "draw_kps": draw_kps}

    def infer(self, model, image, reference, params):
        import cv2
        import torch

        face_app, pipe, draw_kps = model["face_app"], model["pipe"], model["draw_kps"]
        width, height = config.INSTANTID_SIZE
        rgb = image.convert("RGB")
        faces = face_app.get(cv2.cvtColor(np.asarray(rgb), cv2.COLOR_RGB2BGR))
        if not faces:
            raise RuntimeError("no face found in the photo")
        face = max(faces, key=lambda f: (f["bbox"][2] - f["bbox"][0]) * (f["bbox"][3] - f["bbox"][1]))
        control = draw_kps(Image.new("RGB", (width, height), "black"), chibi_keypoints(face["kps"], width, height))
        identity = min(1.2, max(0.3, float(params.get("identity", 0.8))))
        prompt = config.CHIBI_PROMPT + (", " + str(params["prompt"]) if params.get("prompt") else "")
        pipe.set_ip_adapter_scale(identity)
        generator = torch.Generator(device="cpu").manual_seed(int(params.get("seed", 42)))
        return pipe(
            prompt=prompt,
            negative_prompt=config.CHIBI_NEGATIVE,
            image_embeds=face["embedding"],
            image=control,
            controlnet_conditioning_scale=min(1.0, identity),
            ip_adapter_scale=identity,
            num_inference_steps=config.INSTANTID_STEPS,
            guidance_scale=1.5 if config.INSTANTID_LCM else 5.0,
            width=width,
            height=height,
            generator=generator,
        ).images[0]
