"""Server configuration, read from environment variables (optionally a .env file)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load_dotenv() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def env_path(name: str, default: str = "") -> Path | None:
    value = env(name, default)
    return Path(value).expanduser() if value else None


ALLOWED_ORIGINS = [o.strip() for o in env(
    "QUTE_ALLOWED_ORIGINS",
    "https://sywan.github.io,http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173",
).split(",") if o.strip()]
MAX_UPLOAD_MB = float(env("QUTE_MAX_UPLOAD_MB", "20"))
MAX_SIDE = int(env("QUTE_MAX_SIDE", "1024"))
MODELS_DIR = env_path("QUTE_MODELS_DIR", str(ROOT.parent / "public" / "models"))
DEVICE = env("QUTE_DEVICE", "cuda")  # cuda | mps | cpu
PYTHON = env("QUTE_SUBPROCESS_PYTHON", sys.executable)

# DCT-Net (ModelScope)
DCTNET_ENABLED = env("DCTNET_ENABLED", "1") == "1"

# VToonify (git clone of williamyang1991/VToonify + checkpoints)
VTOONIFY_DIR = env_path("VTOONIFY_DIR")
VTOONIFY_CKPT = env("VTOONIFY_CKPT", "checkpoint/vtoonify_d_cartoon/vtoonify_s_d.pt")
VTOONIFY_PYTHON = env("VTOONIFY_PYTHON", PYTHON)
VTOONIFY_STYLE_ID = int(env("VTOONIFY_STYLE_ID", "26"))

# InstantID (git clone of InstantID/InstantID for the pipeline file + checkpoints)
INSTANTID_DIR = env_path("INSTANTID_DIR")
INSTANTID_CHECKPOINTS = env_path("INSTANTID_CHECKPOINTS")  # contains ControlNetModel/ and ip-adapter.bin
INSTANTID_BASE_MODEL = env("INSTANTID_BASE_MODEL", "stabilityai/stable-diffusion-xl-base-1.0")
INSIGHTFACE_ROOT = env_path("INSIGHTFACE_ROOT")  # contains models/antelopev2
CHIBI_LORA = env("CHIBI_LORA")  # local .safetensors path or Hugging Face repo id
CHIBI_LORA_WEIGHT_NAME = env("CHIBI_LORA_WEIGHT_NAME")
CHIBI_LORA_SCALE = float(env("CHIBI_LORA_SCALE", "0.9"))
CHIBI_PROMPT = env(
    "CHIBI_PROMPT",
    "chibi, super deformed, big head, small body, full body, cute, nendoroid figure style, "
    "clean lineart, soft pastel colors, simple background, high quality",
)
CHIBI_NEGATIVE = env(
    "CHIBI_NEGATIVE",
    "realistic, photo, long legs, adult proportions, extra fingers, extra limbs, deformed hands, "
    "lowres, blurry, watermark, text, nsfw",
)
INSTANTID_STEPS = int(env("INSTANTID_STEPS", "30"))

# WarpGAN (git clone of seasonSH/WarpGAN + pretrained model; TensorFlow 1.x environment)
WARPGAN_DIR = env_path("WARPGAN_DIR")
WARPGAN_MODEL = env_path("WARPGAN_MODEL")
WARPGAN_PYTHON = env("WARPGAN_PYTHON", PYTHON)
WARPGAN_CMD = env("WARPGAN_CMD", "{python} test.py {model} {input} {output} --num_styles 1 --scale {scale}")
