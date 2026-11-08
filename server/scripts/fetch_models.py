"""Download the weights the Qute server engines need. Safe to re-run: existing files are skipped.

Usage (from server/):
  python scripts/fetch_models.py vtoonify   --vtoonify-dir vendor/VToonify [--styles cartoon,comic,arcane,pixar]
  python scripts/fetch_models.py instantid  --dest data/instantid
  python scripts/fetch_models.py antelopev2 --root data/insightface
  python scripts/fetch_models.py sdxl       [--repo stabilityai/stable-diffusion-xl-base-1.0]
  python scripts/fetch_models.py warpgan    --dest data/warpgan
  python scripts/fetch_models.py dctnet     (pre-downloads the five ModelScope pipelines)

Sources: VToonify checkpoints from Hugging Face PKUWilliamYang/VToonify (models/...); InstantID
ControlNet + IP-Adapter from InstantX/InstantID; antelopev2 from the insightface v0.7 GitHub
release; WarpGAN pretrained model from the authors' Google Drive link (via gdown).
Python 3.7+.
"""
from __future__ import annotations

import argparse
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

VTOONIFY_REPO = "PKUWilliamYang/VToonify"
VTOONIFY_COMMON = ["models/encoder.pt", "models/faceparsing.pth", "models/shape_predictor_68_face_landmarks.dat"]
VTOONIFY_STYLE_FILES = ["vtoonify_s_d.pt", "exstyle_code.npy"]
ANTELOPE_URL = "https://github.com/deepinsight/insightface/releases/download/v0.7/antelopev2.zip"
WARPGAN_GDRIVE_ID = "1XwjMGcYIg2qwEKHsC7uSmZayHvnEFhyg"
DCTNET_MODELS = [
    "damo/cv_unet_person-image-cartoon_compound-models",
    "damo/cv_unet_person-image-cartoon-3d_compound-models",
    "damo/cv_unet_person-image-cartoon-handdrawn_compound-models",
    "damo/cv_unet_person-image-cartoon-sketch_compound-models",
    "damo/cv_unet_person-image-cartoon-artstyle_compound-models",
]


def log(*args):
    print("[fetch]", *args, flush=True)


def hf_file(repo: str, filename: str, target: Path) -> None:
    if target.exists() and target.stat().st_size > 0:
        log("ok", target)
        return
    from huggingface_hub import hf_hub_download

    target.parent.mkdir(parents=True, exist_ok=True)
    cached = hf_hub_download(repo_id=repo, filename=filename, token=False)  # public repos: ignore any stale HF login
    shutil.copyfile(cached, str(target))
    log("downloaded", target)


def fetch_vtoonify(repo_dir: Path, styles) -> None:
    ck = repo_dir / "checkpoint"
    for name in VTOONIFY_COMMON:
        hf_file(VTOONIFY_REPO, name, ck / Path(name).name)
    for style in styles:
        for name in VTOONIFY_STYLE_FILES:
            hf_file(VTOONIFY_REPO, "models/vtoonify_d_{}/{}".format(style, name), ck / "vtoonify_d_{}".format(style) / name)


def fetch_instantid(dest: Path) -> None:
    for name in ("ControlNetModel/config.json", "ControlNetModel/diffusion_pytorch_model.safetensors", "ip-adapter.bin"):
        hf_file("InstantX/InstantID", name, dest / name)


def fetch_antelopev2(root: Path) -> None:
    target = root / "models" / "antelopev2"
    if target.exists() and len(list(target.glob("*.onnx"))) >= 5:
        log("ok", target)
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    zip_path = target.parent / "antelopev2.zip"
    log("downloading", ANTELOPE_URL, "(~360 MB)")
    urllib.request.urlretrieve(ANTELOPE_URL, str(zip_path))
    with zipfile.ZipFile(str(zip_path)) as zf:
        zf.extractall(str(target.parent))
    zip_path.unlink()
    nested = target / "antelopev2"  # some archives nest the folder twice
    if nested.is_dir():
        for f in nested.iterdir():
            shutil.move(str(f), str(target / f.name))
        nested.rmdir()
    log("extracted", target, sorted(p.name for p in target.glob("*.onnx")))


def fetch_sdxl(repo: str) -> None:
    from huggingface_hub import snapshot_download

    path = snapshot_download(repo, allow_patterns=["*.json", "*.txt", "tokenizer*/*", "*fp16.safetensors"], token=False)
    log("SDXL base ready in", path)


def fetch_lcm() -> None:
    from huggingface_hub import hf_hub_download

    hf_hub_download("latent-consistency/lcm-lora-sdxl", "pytorch_lora_weights.safetensors", token=False)
    log("LCM-LoRA ready")


def fetch_warpgan(dest: Path) -> Path:
    found = [p.parent for p in dest.rglob("*.meta")] if dest.exists() else []
    if found:
        log("ok", found[0])
        return found[0]
    import gdown

    dest.mkdir(parents=True, exist_ok=True)
    zip_path = dest / "warpgan_pretrained.zip"
    gdown.download(id=WARPGAN_GDRIVE_ID, output=str(zip_path), quiet=False)
    with zipfile.ZipFile(str(zip_path)) as zf:
        zf.extractall(str(dest))
    zip_path.unlink()
    found = [p.parent for p in dest.rglob("*.meta")]
    if not found:
        sys.exit("WarpGAN archive did not contain a TensorFlow checkpoint (*.meta)")
    log("WarpGAN model in", found[0])
    return found[0]


def fetch_dctnet() -> None:
    from modelscope.hub.snapshot_download import snapshot_download

    for model in DCTNET_MODELS:
        try:
            path = snapshot_download(model)
        except Exception:  # noqa: BLE001 — newer ModelScope namespace
            path = snapshot_download(model.replace("damo/", "iic/"))
        log("ModelScope", model, "->", path)


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("what", choices=["vtoonify", "instantid", "antelopev2", "sdxl", "lcm", "warpgan", "dctnet"])
    ap.add_argument("--vtoonify-dir", default="vendor/VToonify")
    ap.add_argument("--styles", default="cartoon,comic,arcane,pixar")
    ap.add_argument("--dest", default="")
    ap.add_argument("--root", default="data/insightface")
    ap.add_argument("--repo", default="stabilityai/stable-diffusion-xl-base-1.0")
    args = ap.parse_args(argv)
    if args.what == "vtoonify":
        fetch_vtoonify(Path(args.vtoonify_dir), [s.strip() for s in args.styles.split(",") if s.strip()])
    elif args.what == "instantid":
        fetch_instantid(Path(args.dest or "data/instantid"))
    elif args.what == "antelopev2":
        fetch_antelopev2(Path(args.root))
    elif args.what == "sdxl":
        fetch_sdxl(args.repo)
    elif args.what == "lcm":
        fetch_lcm()
    elif args.what == "warpgan":
        print(fetch_warpgan(Path(args.dest or "data/warpgan")))
    elif args.what == "dctnet":
        fetch_dctnet()


if __name__ == "__main__":
    main()
