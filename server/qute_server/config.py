"""Server configuration, read from environment variables (optionally server/.env).

Compatible with Python 3.7+ because the WarpGAN worker runs on TensorFlow 1.15 / Python 3.7.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load_dotenv() -> None:
    env_file = Path(os.environ.get("QUTE_ENV_FILE", str(ROOT / ".env")))
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.split(" #", 1)[0].strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)


_load_dotenv()


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def env_path(name: str, default: str = ""):
    value = env(name, default)
    return Path(value).expanduser() if value else None


def _pairs(value: str) -> dict:
    out = {}
    for item in value.split(","):
        if "=" in item:
            key, url = item.split("=", 1)
            if key.strip() and url.strip():
                out[key.strip()] = url.strip().rstrip("/")
    return out


ALLOWED_ORIGINS = [o.strip() for o in env(
    "QUTE_ALLOWED_ORIGINS",
    "https://sywan.github.io,http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173",
).split(",") if o.strip()]
MAX_UPLOAD_MB = float(env("QUTE_MAX_UPLOAD_MB", "20"))
MAX_SIDE = int(env("QUTE_MAX_SIDE", "1024"))
MODELS_DIR = env_path("QUTE_MODELS_DIR", str(ROOT.parent / "public" / "models"))
DEVICE = env("QUTE_DEVICE", "cuda")  # cuda | mps | cpu
PYTHON = env("QUTE_SUBPROCESS_PYTHON", sys.executable)

# Which engines this process serves itself ("all" or comma list), and which are forwarded
# to other Qute worker processes: "dctnet=http://127.0.0.1:8766,warpgan=http://gpu-box:8767".
LOCAL_ENGINES = env("QUTE_ENGINES", "all")
REMOTE_ENGINES = _pairs(env("QUTE_REMOTE_ENGINES", ""))
REMOTE_TIMEOUT = float(env("QUTE_REMOTE_TIMEOUT", "600"))

# DCT-Net (ModelScope)
DCTNET_ENABLED = env("DCTNET_ENABLED", "1") == "1"

# VToonify (clone of williamyang1991/VToonify with checkpoints in checkpoint/)
VTOONIFY_DIR = env_path("VTOONIFY_DIR")
VTOONIFY_PYTHON = env("VTOONIFY_PYTHON", PYTHON)
VTOONIFY_DEVICE = env("VTOONIFY_DEVICE", "cuda" if DEVICE == "cuda" else "cpu")
# variant -> (checkpoint relative to VTOONIFY_DIR, default style id). Style ids follow DualStyleGAN.
VTOONIFY_STYLES = {
    "cartoon": ("checkpoint/vtoonify_d_cartoon/vtoonify_s_d.pt", 26),
    "comic": ("checkpoint/vtoonify_d_comic/vtoonify_s_d.pt", 28),
    "arcane": ("checkpoint/vtoonify_d_arcane/vtoonify_s_d.pt", 77),
    "pixar": ("checkpoint/vtoonify_d_pixar/vtoonify_s_d.pt", 52),
}

# InstantID (clone of InstantID/InstantID for the pipeline file + checkpoints)
INSTANTID_DIR = env_path("INSTANTID_DIR")
INSTANTID_CHECKPOINTS = env_path("INSTANTID_CHECKPOINTS")  # contains ControlNetModel/ and ip-adapter.bin
INSTANTID_BASE_MODEL = env("INSTANTID_BASE_MODEL", "stabilityai/stable-diffusion-xl-base-1.0")
INSTANTID_VARIANT = env("INSTANTID_VARIANT", "fp16")  # fp16 weights variant of the base model; empty to disable
HF_USE_TOKEN = env("HF_USE_TOKEN", "0") == "1"  # 1 only if INSTANTID_BASE_MODEL / CHIBI_LORA are gated or private
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
INSTANTID_LCM = env("INSTANTID_LCM", "0") == "1"  # LCM-LoRA: ~8 steps instead of 30 (recommended on Mac)
INSTANTID_LCM_LORA = env("INSTANTID_LCM_LORA", "latent-consistency/lcm-lora-sdxl")
INSTANTID_STEPS = int(env("INSTANTID_STEPS", "8" if INSTANTID_LCM else "30"))
INSTANTID_CPU_OFFLOAD = env("INSTANTID_CPU_OFFLOAD", "0") == "1"  # for GPUs with < 16 GB VRAM
INSTANTID_SIZE = tuple(int(v) for v in env("INSTANTID_SIZE", "896x1152").lower().split("x"))

# WarpGAN (clone of seasonSH/WarpGAN + pretrained model; TensorFlow 1.x environment)
WARPGAN_DIR = env_path("WARPGAN_DIR")
WARPGAN_MODEL = env_path("WARPGAN_MODEL")
WARPGAN_PYTHON = env("WARPGAN_PYTHON", PYTHON)
WARPGAN_CMD = env("WARPGAN_CMD", "{python} test.py {model} {input} {output} --num_styles 1 --scale {scale}")
