"""Download InstantID checkpoints (ControlNet + IP-Adapter) from Hugging Face.

Usage: python scripts/download_instantid.py ./checkpoints/instantid
Then set INSTANTID_CHECKPOINTS to that folder. The antelopev2 face model for insightface must be
placed separately under INSIGHTFACE_ROOT/models/antelopev2 (see the InstantID README).
"""
import sys

from huggingface_hub import hf_hub_download

target = sys.argv[1] if len(sys.argv) > 1 else "./checkpoints/instantid"
for name in ("ControlNetModel/config.json", "ControlNetModel/diffusion_pytorch_model.safetensors", "ip-adapter.bin"):
    path = hf_hub_download(repo_id="InstantX/InstantID", filename=name, local_dir=target)
    print("downloaded", path)
