"""Engines that run an upstream repository's own inference script in a subprocess.

VToonify and WarpGAN depend on specific framework versions (custom ops; TensorFlow 1.x),
so Qute calls each repository's script with a chosen Python interpreter instead of importing it.
"""
from __future__ import annotations

import os
import shlex
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

from .. import config
from .base import Engine


def _find_image(folder: Path, must_contain: str = "", exclude: str = "") -> Path:
    files = [p for p in folder.rglob("*") if p.suffix.lower() in {".jpg", ".jpeg", ".png"}
             and must_contain in p.name and not (exclude and exclude in p.name)]
    if not files:
        raise RuntimeError("the script finished but wrote no result image")
    return max(files, key=lambda p: p.stat().st_mtime)


def _run(cmd, cwd: Path, timeout: int = 900, extra_env=None) -> None:
    env = dict(os.environ, **(extra_env or {}))
    proc = subprocess.run(cmd, cwd=str(cwd), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          universal_newlines=True, timeout=timeout, env=env)
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-8:]
        raise RuntimeError("inference script failed: " + " | ".join(tail))


class VToonifyEngine(Engine):
    """VToonify (Yang et al., ACM TOG 2022) via the official style_transfer.py."""

    def __init__(self):
        super().__init__(id="vtoonify", variants=list(config.VTOONIFY_STYLES))

    def available_variants(self):
        d = config.VTOONIFY_DIR
        return [v for v, (ckpt, _) in config.VTOONIFY_STYLES.items() if d and (d / ckpt).exists()]

    def check(self):
        d = config.VTOONIFY_DIR
        if not d:
            return False, "set VTOONIFY_DIR to a clone of williamyang1991/VToonify"
        if not (d / "style_transfer.py").exists():
            return False, "style_transfer.py not found in {}".format(d)
        missing = [f for f in ("checkpoint/encoder.pt", "checkpoint/faceparsing.pth",
                               "checkpoint/shape_predictor_68_face_landmarks.dat") if not (d / f).exists()]
        if missing:
            return False, "missing VToonify files: " + ", ".join(missing) + " (run scripts/fetch_models.py vtoonify)"
        if not self.available_variants():
            return False, "no VToonify style checkpoints found (run scripts/fetch_models.py vtoonify)"
        return True, ""

    def infer(self, _model, image, reference, params):
        variants = self.available_variants()
        variant = params.get("variant") if params.get("variant") in variants else variants[0]
        ckpt, default_style = config.VTOONIFY_STYLES[variant]
        degree = min(1.0, max(0.0, float(params.get("style_degree", 0.5))))
        style_id = int(params.get("style_id", default_style))
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            src = tmp / "photo.jpg"
            image.convert("RGB").save(str(src), quality=95)
            out_dir = tmp / "out"
            out_dir.mkdir()
            cmd = [config.VTOONIFY_PYTHON, "style_transfer.py", "--scale_image", "--content", str(src),
                   "--style_id", str(style_id), "--style_degree", "{:.2f}".format(degree),
                   "--ckpt", ckpt, "--output_path", str(out_dir) + "/",
                   "--padding", "600", "600", "600", "600"]
            if config.VTOONIFY_DEVICE != "cuda":
                cmd.append("--cpu")
            _run(cmd, config.VTOONIFY_DIR, extra_env={"TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD": "1"})
            return Image.open(str(_find_image(out_dir, must_contain="vtoonify"))).convert("RGB")


class WarpGANEngine(Engine):
    """WarpGAN (Shi, Deb & Jain, CVPR 2019) via the official test.py (WARPGAN_CMD)."""

    def __init__(self):
        super().__init__(id="warpgan")

    def check(self):
        if not config.WARPGAN_DIR or not (config.WARPGAN_DIR / "test.py").exists():
            return False, "set WARPGAN_DIR to a clone of seasonSH/WarpGAN"
        if not config.WARPGAN_MODEL or not config.WARPGAN_MODEL.exists():
            return False, "set WARPGAN_MODEL to the pretrained model directory (run scripts/fetch_models.py warpgan)"
        return True, ""

    def infer(self, _model, image, reference, params):
        scale = min(2.0, max(0.2, float(params.get("exaggeration", 1.0))))
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            src = tmp / "photo.png"
            image.convert("RGB").save(str(src))
            out_dir = tmp / "out"
            out_dir.mkdir()
            cmd = config.WARPGAN_CMD.format(
                python=shlex.quote(config.WARPGAN_PYTHON), model=shlex.quote(str(config.WARPGAN_MODEL)),
                input=shlex.quote(str(src)), output=shlex.quote(str(out_dir / "result")), scale="{:.2f}".format(scale))
            _run(shlex.split(cmd), config.WARPGAN_DIR)
            return Image.open(str(_find_image(out_dir, must_contain="result"))).convert("RGB")
