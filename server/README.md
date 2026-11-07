# Qute self-hosted inference server（自架推論伺服器）

The Qute web app runs AnimeGANv2/v3, White-box Cartoonization and YuNet in the visitor's browser.
This optional server adds the heavier algorithms that need Python/PyTorch and usually a GPU.
It runs on **your** computer or server, so no cloud AI quota is used and photos go only to the address you enter in Qute → Advanced → Your server URL.

Qute 網頁版在瀏覽器內執行 AnimeGANv2／v3、White-box 與 YuNet。本伺服器為選用，負責需要 Python／PyTorch（通常需 GPU）的演算法；部署在你自己的電腦或伺服器，不使用雲端 AI 額度，照片只會傳到你在「進階設定 → 自架伺服器網址」填入的位址。

| Engine id | Algorithm | What it does | Needs |
| --- | --- | --- | --- |
| `server-whitebox` | White-box Cartoonization (CVPR 2020) | Same as the browser version, larger sizes | `requirements.txt` only (works out of the box) |
| `dctnet` | DCT-Net (ACM TOG / SIGGRAPH 2022) | Portrait cartoonisation; variants `anime`, `3d`, `handdrawn`, `sketch`, `artstyle` | `requirements-dctnet.txt`; ModelScope downloads weights on first use |
| `vtoonify` | VToonify (ACM TOG / SIGGRAPH Asia 2022) | High-res portrait stylisation, adjustable `style_degree` | Clone of the repo + checkpoints, its own conda env (custom CUDA ops) |
| `instantid-chibi` | InstantID + IP-Adapter + SDXL + chibi LoRA | True big-head / small-body redraw that keeps the person's identity | `requirements-instantid.txt`, ≥12 GB VRAM GPU, InstantID checkpoints, antelopev2, a chibi SDXL LoRA |
| `warpgan` | WarpGAN (CVPR 2019) | Automatic caricature (TPS warping + texture) | Clone of the repo, pretrained model, TensorFlow 1.x env |

## Quick start (White-box only, any computer)

```sh
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn qute_server.app:app --host 127.0.0.1 --port 8765
```

Open Qute → **Advanced** → *Your server URL* = `http://localhost:8765` → **Connect**. Qute lists the engines whose dependencies are present; the rest show the reason in `GET /api/engines`.

Browser notes: Chrome, Edge and Firefox allow `https://sywan.github.io` to call `http://localhost`. Safari blocks HTTP calls from HTTPS pages, and phones cannot reach your `localhost`; for those, put the server behind HTTPS (for example a reverse proxy with a certificate, or a tunnel) and add that origin to `QUTE_ALLOWED_ORIGINS` if you host Qute elsewhere.

## Adding engines

### DCT-Net

```sh
pip install -r requirements-dctnet.txt
```

The first request per variant downloads the ModelScope model (`damo/cv_unet_person-image-cartoon*_compound-models`). If TensorFlow conflicts with PyTorch, run a second server instance in its own venv on another port.

### VToonify

```sh
git clone https://github.com/williamyang1991/VToonify ~/models/VToonify
# create its conda env as described in the VToonify README and download checkpoints
# (e.g. checkpoint/vtoonify_d_cartoon/vtoonify_s_d.pt plus the shared encoder/faceparsing files)
```

Set `VTOONIFY_DIR`, `VTOONIFY_CKPT`, `VTOONIFY_PYTHON` (that env's python) in `.env`. Qute calls `style_transfer.py --scale_image --style_degree …`; the slider in Qute sets `style_degree`.

### InstantID chibi

```sh
pip install -r requirements-instantid.txt
git clone https://github.com/InstantID/InstantID ~/models/InstantID
python scripts/download_instantid.py ~/models/InstantID/checkpoints
# put insightface antelopev2 in ~/models/InstantID/models/antelopev2 (see InstantID README)
```

Set `INSTANTID_DIR`, `INSTANTID_CHECKPOINTS`, `INSIGHTFACE_ROOT`, and `CHIBI_LORA` (an SDXL chibi / nendoroid / blind-box LoRA whose licence you accept). The server redraws the face keypoints into a two-head-tall layout (large head in the upper third of an 896×1152 canvas) so ControlNet pushes the composition toward chibi proportions. Only the largest face is used; for group photos use the browser pipeline or DCT-Net.

### WarpGAN

WarpGAN needs TensorFlow 1.x (Python ≤3.7). Clone `seasonSH/WarpGAN`, download the pretrained model, create its env, then set `WARPGAN_DIR`, `WARPGAN_MODEL`, `WARPGAN_PYTHON`. If your checkout's `test.py` arguments differ, adjust `WARPGAN_CMD` (placeholders: `{python} {model} {input} {output} {scale}`). WarpGAN expects aligned faces; check its README for alignment.

## API

- `GET /api/health`
- `GET /api/engines` → `{"engines":[{"id","available","reason"?,"variants"?}]}`
- `POST /api/stylize` (multipart) `engine`, `params` (JSON: `variant`, `style_degree`, `identity`, `exaggeration`, `prompt`, `seed`), `image`, optional `reference` → `image/png`

Uploads are limited to `QUTE_MAX_UPLOAD_MB` (20 MB) and resized to `QUTE_MAX_SIDE` (1024 px). Images are processed in memory; temporary files used by subprocess engines are deleted after each request. CORS is limited to `QUTE_ALLOWED_ORIGINS` and answers Chrome's Private Network Access preflight.

## Tests

```sh
pip install -r requirements-dev.txt
python -m pytest -q tests
```

## Licences

Each upstream model keeps its own licence (VToonify: S-Lab License 1.0, non-commercial; White-box: CC BY-NC-SA 4.0; check DCT-Net/ModelScope model cards, the SDXL base model and your LoRA). This server code is part of Qute.

## References

- Men, Y., Yao, Y., Cui, M., Lian, Z., & Xie, X. (2022). DCT-Net: Domain-calibrated translation for portrait stylization. *ACM TOG*, 41(4), 1–9.
- Yang, S., Jiang, L., Liu, Z., & Loy, C. C. (2022). VToonify: Controllable high-resolution portrait video style transfer. *ACM TOG*, 41(6), 1–15.
- Wang, Q., Bai, X., Wang, H., Qin, Z., & Chen, A. (2024). InstantID: Zero-shot identity-preserving generation in seconds. arXiv:2401.07519.
- Ye, H., Zhang, J., Liu, S., Han, X., & Yang, W. (2023). IP-Adapter: Text compatible image prompt adapter for text-to-image diffusion models. arXiv:2308.06721.
- Shi, Y., Deb, D., & Jain, A. K. (2019). WarpGAN: Automatic caricature generation. *CVPR*, 10762–10771.
- Wang, X., & Yu, J. (2020). Learning to cartoonize using white-box cartoon representations. *CVPR*, 8090–8099.
