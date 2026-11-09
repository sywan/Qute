# Qute GPU server（自架推論伺服器）

Optional server for the Qute web app. It runs the algorithms that need Python/PyTorch and a GPU on
**your own** machine, so no cloud AI quota is used and photos go only to the URL you enter in
Qute → Advanced → *Your server URL*.

選用的 Qute 自架伺服器：在你自己的機器上執行需要 Python／GPU 的演算法，不使用雲端 AI 額度；照片只會傳到你在「進階設定 → 自架伺服器網址」填入的位址。

| Engine id | Algorithm | Linux + NVIDIA (Docker) | Apple Silicon Mac |
| --- | --- | --- | --- |
| `server-whitebox` | White-box Cartoonization (CVPR 2020) | ✓ | ✓ |
| `dctnet` | DCT-Net (ACM TOG 2022), variants `anime` `3d` `handdrawn` `sketch` `artstyle` | ✓ GPU | ✓ CPU (TensorFlow venv) |
| `vtoonify` | VToonify (ACM TOG 2022), variants `cartoon` `comic` `arcane` `pixar`, `style_degree` | ✓ GPU | ✓ CPU, ≈20–60 s |
| `instantid-chibi` | InstantID + IP-Adapter + SDXL + your chibi LoRA | ✓ GPU, 12 GB+ VRAM | ✓ MPS with LCM, ≈1–3 min, 32 GB+ RAM recommended |
| `warpgan` | WarpGAN (CVPR 2019) | ✓ CPU container | via Docker x86 emulation (may fail) or forward to the Linux box |

## Architecture

```
browser (sywan.github.io/Qute) ──HTTP──▶ gateway :8765 ── White-box, InstantID, VToonify (in process / subprocess)
                                           ├──▶ dctnet worker   (TensorFlow 2 environment)
                                           └──▶ warpgan worker  (TensorFlow 1.15 / Python 3.7)
```

Every process is the same `qute_server` app. `QUTE_ENGINES` chooses what a process runs itself;
`QUTE_REMOTE_ENGINES=id=url,…` forwards engines to other processes or machines. The gateway's
`GET /api/engines` shows each engine as READY or the reason it is off.

## A. Linux + NVIDIA GPU (Docker Compose) — all five engines

Requirements: Docker with the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html), NVIDIA driver ≥ 530 (CUDA 12.1), 12 GB+ VRAM, ≈60 GB disk.

```sh
git clone https://github.com/sywan/Qute.git && cd Qute/server/deploy/linux
cp .env.example .env
cp /path/to/your-chibi-lora.safetensors loras/chibi.safetensors   # optional but recommended
docker compose up -d --build          # first build ≈15–30 min (dlib, insightface compile)
docker compose logs -f qute           # first start downloads ≈20 GB of weights into ./data
curl http://localhost:8765/api/engines
```

Use `INSTANTID_CPU_OFFLOAD=1` in `.env` for GPUs under 16 GB, `INSTANTID_LCM=1` for ≈4× faster chibi.
WarpGAN's model comes from the authors' Google Drive; if the automatic download is blocked, download it
from the [WarpGAN README](https://github.com/seasonSH/WarpGAN#pre-trained-model), unzip into
`deploy/linux/data/warpgan/` and run `docker compose restart warpgan`.

## B. Apple Silicon Mac

Requirements: Xcode Command Line Tools, Homebrew, ≈35 GB disk.

```sh
cd Qute/server
./deploy/mac/setup.sh                 # venvs, upstream repos, weights; writes server/.env
cp /path/to/your-chibi-lora.safetensors loras/chibi.safetensors
./deploy/mac/run.sh                   # gateway :8765 + DCT-Net worker :8766; Ctrl-C to stop
```

`--skip-instantid` leaves out SDXL (saves ≈10 GB). WarpGAN has no Apple Silicon TensorFlow 1.x;
try `./deploy/mac/warpgan-docker.sh` (Docker Desktop, x86 emulation) or forward it to the Linux box.

## C. Both: Mac front end, Linux box for the heavy engines

Run A on the Linux box and B on the Mac. Tunnel the Linux gateway to the Mac and forward engines to it
in `server/.env` on the Mac:

```sh
ssh -N -L 8775:localhost:8765 user@gpu-box &          # Linux gateway appears as localhost:8775
# server/.env on the Mac
QUTE_REMOTE_ENGINES=dctnet=http://127.0.0.1:8766,warpgan=http://127.0.0.1:8775,instantid-chibi=http://127.0.0.1:8775
```

Restart `run.sh`. The Mac now serves White-box, VToonify and DCT-Net locally and sends WarpGAN and
InstantID to the GPU box.

## Connecting Qute

Opening `http://localhost:8765` in a browser shows a status page listing every engine as READY or the reason it is off. Then open <https://sywan.github.io/Qute/> → **Advanced** → *Your server URL* `http://localhost:8765` → **Connect**.
Chrome, Edge and Firefox allow an HTTPS page to call `http://localhost`. Safari, phones and other
computers cannot call a plain-HTTP server; for those use an SSH tunnel as above (so the server is
`localhost` on that computer) or put the gateway behind HTTPS (for example `tailscale serve` or a
reverse proxy with a certificate) and add that origin to `QUTE_ALLOWED_ORIGINS` if Qute is hosted elsewhere.

## Your chibi LoRA

Qute does not bundle one. Use an SDXL LoRA for chibi / nendoroid / blind-box style whose licence fits
your use, save it as `loras/chibi.safetensors` (or set `CHIBI_LORA` to a file path or a Hugging Face repo
id plus `CHIBI_LORA_WEIGHT_NAME`). Without it InstantID still runs with the chibi prompt and big-head
keypoint layout, and `/api/engines` shows a note. Tune `CHIBI_LORA_SCALE` (0.6–1.0) and `CHIBI_PROMPT`
(add the LoRA's trigger words).

## Configuration reference

All settings are environment variables (or `server/.env`); see `qute_server/config.py`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `QUTE_ENGINES` | `all` | engines this process runs itself |
| `QUTE_REMOTE_ENGINES` | — | `id=url,…` engines forwarded to other Qute processes |
| `QUTE_DEVICE` | `cuda` | `cuda`, `mps` or `cpu` (InstantID) |
| `QUTE_ALLOWED_ORIGINS` | sywan.github.io + localhost | CORS origins |
| `VTOONIFY_DIR` / `VTOONIFY_PYTHON` / `VTOONIFY_DEVICE` | — / this python / `cuda` or `cpu` | VToonify clone, interpreter, device |
| `INSTANTID_DIR` / `INSTANTID_CHECKPOINTS` / `INSIGHTFACE_ROOT` | — | InstantID clone, ControlNet + IP-Adapter, antelopev2 |
| `INSTANTID_BASE_MODEL` | `stabilityai/stable-diffusion-xl-base-1.0` | any SDXL checkpoint (HF id or path) |
| `INSTANTID_LCM` / `INSTANTID_STEPS` / `INSTANTID_SIZE` | `0` / 30 (8 with LCM) / `896x1152` | speed and output size |
| `INSTANTID_CPU_OFFLOAD` | `0` | model CPU offload for < 16 GB VRAM |
| `CHIBI_LORA` / `CHIBI_LORA_SCALE` / `CHIBI_PROMPT` / `CHIBI_NEGATIVE` | — / 0.9 / built-in | chibi style |
| `WARPGAN_DIR` / `WARPGAN_MODEL` / `WARPGAN_PYTHON` / `WARPGAN_CMD` | — | WarpGAN clone, model, interpreter, command template |

Upstream code is cloned at pinned commits by `scripts/vendor.py`; weights are fetched by
`scripts/fetch_models.py` (both re-runnable). VToonify is patched to its pure-PyTorch StyleGAN ops, so no
CUDA compiler is needed.

## API

Full protocol for building or connecting your own server (any language), custom engines with
their own controls, and a conformance checker: **[docs/SERVER_API.md](../docs/SERVER_API.md)**.
Add your own model as a plugin with `QUTE_PLUGINS=path/to/plugin.py` (example:
`examples/plugin_example.py`), or start from the one-file `examples/minimal_server.py`.


- `GET /api/health`, `GET /api/engines`
- `POST /api/warmup?engine=ID` — load weights before the first request
- `POST /api/stylize` (multipart) `engine`, `params` (JSON: `variant`, `style_degree`, `identity`, `exaggeration`, `prompt`, `seed`), `image`, optional `reference` → `image/png`

Uploads are limited to 20 MB and resized to 1024 px; images are processed in memory and temporary files
are deleted after each request.

## Tests

```sh
pip install -r requirements-dev.txt && python -m pytest -q tests
```

Covered here: API, CORS / Private Network Access, gateway → worker forwarding, VToonify and WarpGAN
command lines (with stand-in scripts), and the InstantID engine end to end on CPU with a tiny random SDXL,
real antelopev2 face detection, a chibi LoRA and the LCM option. Not covered: real-weight quality on a
GPU, the Docker images (Docker Hub is not reachable from the build environment), and ModelScope downloads.

## Licences

Each upstream model keeps its own licence: VToonify S-Lab License 1.0 (non-commercial), White-box
CC BY-NC-SA 4.0, DCT-Net / ModelScope model cards, SDXL CreativeML Open RAIL++-M, InstantID Apache-2.0
(code) and its model card, insightface antelopev2 (non-commercial research), WarpGAN MIT, plus your LoRA.

## References

- Men, Y., Yao, Y., Cui, M., Lian, Z., & Xie, X. (2022). DCT-Net: Domain-calibrated translation for portrait stylization. *ACM TOG*, 41(4), 1–9.
- Yang, S., Jiang, L., Liu, Z., & Loy, C. C. (2022). VToonify: Controllable high-resolution portrait video style transfer. *ACM TOG*, 41(6), 1–15.
- Wang, Q., Bai, X., Wang, H., Qin, Z., & Chen, A. (2024). InstantID: Zero-shot identity-preserving generation in seconds. arXiv:2401.07519.
- Ye, H., Zhang, J., Liu, S., Han, X., & Yang, W. (2023). IP-Adapter: Text compatible image prompt adapter for text-to-image diffusion models. arXiv:2308.06721.
- Shi, Y., Deb, D., & Jain, A. K. (2019). WarpGAN: Automatic caricature generation. *CVPR*, 10762–10771.
- Wang, X., & Yu, J. (2020). Learning to cartoonize using white-box cartoon representations. *CVPR*, 8090–8099.
