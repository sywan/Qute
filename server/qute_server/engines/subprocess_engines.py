"""Engines that run an upstream repository's own inference script in a subprocess.

VToonify and WarpGAN depend on specific framework versions (custom CUDA ops; TensorFlow 1.x),
so Qute calls each repository's script with its own Python interpreter instead of importing it.
"""
from __future__ import annotations

import shlex
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

from .. import config
from .base import Engine


def _newest_image(folder: Path, stem_hint: str = "") -> Path:
    files = [p for p in folder.rglob("*") if p.suffix.lower() in {".jpg", ".jpeg", ".png"} and p.stem != stem_hint]
    if not files:
        raise RuntimeError("the script finished but wrote no image")
    return max(files, key=lambda p: p.stat().st_mtime)


def _run(cmd: list[str], cwd: Path, timeout: int = 600) -> None:
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-8:]
        raise RuntimeError("inference script failed: " + " | ".join(tail))


class VToonifyEngine(Engine):
    """VToonify (Yang et al., ACM TOG 2022). Uses style_transfer.py from the official repository."""

    def __init__(self):
        super().__init__(id="vtoonify")

    def check(self):
        d = config.VTOONIFY_DIR
        if not d:
            return False, "set VTOONIFY_DIR to a clone of williamyang1991/VToonify"
        if not (d / "style_transfer.py").exists():
            return False, f"style_transfer.py not found in {d}"
        if not (d / config.VTOONIFY_CKPT).exists():
            return False, f"checkpoint not found: {d / config.VTOONIFY_CKPT}"
        return True, ""

    def infer(self, _model, image, reference, params):
        degree = min(1.0, max(0.0, float(params.get("style_degree", 0.5))))
        style_id = int(params.get("style_id", config.VTOONIFY_STYLE_ID))
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            src = tmp / "input.jpg"
            image.convert("RGB").save(src, quality=95)
            out_dir = tmp / "out"
            out_dir.mkdir()
            cmd = [config.VTOONIFY_PYTHON, "style_transfer.py", "--scale_image", "--content", str(src),
                   "--style_id", str(style_id), "--style_degree", f"{degree:.2f}",
                   "--ckpt", config.VTOONIFY_CKPT, "--output_path", str(out_dir),
                   "--padding", "600", "600", "600", "600"]
            if config.DEVICE == "cpu":
                cmd.append("--cpu")
            _run(cmd, config.VTOONIFY_DIR)
            result = _newest_image(out_dir, "input")
            return Image.open(result).convert("RGB")


class WarpGANEngine(Engine):
    """WarpGAN (Shi, Deb & Jain, CVPR 2019). Command is configurable via WARPGAN_CMD."""

    def __init__(self):
        super().__init__(id="warpgan")

    def check(self):
        if not config.WARPGAN_DIR or not (config.WARPGAN_DIR / "test.py").exists():
            return False, "set WARPGAN_DIR to a clone of seasonSH/WarpGAN"
        if not config.WARPGAN_MODEL or not config.WARPGAN_MODEL.exists():
            return False, "set WARPGAN_MODEL to the pretrained model directory"
        return True, ""

    def infer(self, _model, image, reference, params):
        scale = min(2.0, max(0.2, float(params.get("exaggeration", 1.0))))
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            src = tmp / "input.png"
            image.convert("RGB").save(src)
            out_dir = tmp / "out"
            out_dir.mkdir()
            cmd = config.WARPGAN_CMD.format(python=shlex.quote(config.WARPGAN_PYTHON), model=shlex.quote(str(config.WARPGAN_MODEL)),
                                            input=shlex.quote(str(src)), output=shlex.quote(str(out_dir / "result")), scale=f"{scale:.2f}")
            _run(shlex.split(cmd), config.WARPGAN_DIR)
            return Image.open(_newest_image(out_dir)).convert("RGB")
