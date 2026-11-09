# Qute Server API — `qute-server/1`

How to connect the Qute web app to **your own** inference server: the interface, the rules a server
must follow, and three ways to build one.

本文件說明如何讓 Qute 網頁連線到**你自己的**推論伺服器：介面規格、伺服器必須遵守的規則，以及三種實作方式。中文導覽在前，完整英文規格在後。

---

## 中文導覽

### 概念

- **Qute 網頁是用戶端，伺服器是另一個獨立程式。** 網頁在瀏覽器執行；按下「轉換」時，若選的是伺服器演算法，瀏覽器會把照片以 HTTP 傳給使用者在「進階設定 → 自架伺服器網址」填入的位址，取回結果圖片。
- **任何語言都可以實作伺服器**（Python、Node.js、Go…），只要提供下列三個網址並遵守跨來源（CORS）規則。
- **照片只會傳到你填的網址**，不經過 Qute 或任何雲端服務。

### 伺服器必須提供

| 網址 | 用途 |
| --- | --- |
| `GET /api/health` | 回傳 `{"ok": true, "api": "qute-server/1"}`，表示伺服器在線 |
| `GET /api/engines` | 列出可用的演算法（引擎）：代號、是否可用、名稱、說明、可調參數 |
| `POST /api/stylize` | 收到照片（multipart 表單：`engine`、`params`、`image`、選用 `reference`），回傳轉換後的圖片（建議 PNG） |

### 你的模型如何出現在 Qute

伺服器在 `/api/engines` 回報**新的引擎代號**（例如 `my-model`），並附上 `label`（名稱）、`description`（說明）、`params`（參數）。Qute 會自動把它列在「進階設定 → 演算法 → 自架伺服器」，並依 `params` 產生滑桿、下拉選單、勾選框或文字欄位；轉換時把使用者設定的值放進 `params` 傳給伺服器。名稱與說明可同時提供英文與繁體中文。

### 三種做法

1. **最簡單：使用 Qute 伺服器加「外掛」**——寫一個 Python 檔，定義一個 `Engine` 類別、實作 `infer()`，用 `QUTE_PLUGINS=你的檔案.py` 啟動。範例：[`server/examples/plugin_example.py`](../server/examples/plugin_example.py)。
2. **自己寫伺服器**——參考單一檔案的完整範例 [`server/examples/minimal_server.py`](../server/examples/minimal_server.py)，把 `my_model()` 換成你的模型。
3. **轉接其他機器**——Qute 伺服器可用 `QUTE_REMOTE_ENGINES=引擎=網址` 把某個引擎轉給另一台機器（例如實驗室 GPU 主機）。

### 必要的瀏覽器規則（最常見的連線失敗原因）

- 回應必須允許 Qute 網站的來源：`Access-Control-Allow-Origin: https://sywan.github.io`。
- Chrome 從 HTTPS 網頁連到 `localhost`／區網時，會先送預檢請求；伺服器必須回 `Access-Control-Allow-Private-Network: true`。
- `http://localhost` 在 Chrome、Edge、Firefox 可用；Safari、手機或其他電腦需要 **HTTPS** 網址（例如 `tailscale serve`、反向代理），或用 SSH 通道讓伺服器在該電腦上成為 `localhost`。

### 驗證

```sh
python server/scripts/check_server.py http://localhost:8765
```

這支檢查程式只用 Python 標準函式庫，會逐項測試健康檢查、引擎清單格式、CORS／私人網路預檢，並對每個可用引擎送出一張測試圖片。全部 PASS 後，在 Qute「進階設定」輸入網址並按「連線」即可。

---

## 1. Roles

| | Qute web app (client) | Your server |
| --- | --- | --- |
| Runs in | The visitor's browser (https://sywan.github.io/Qute/) | Any machine the visitor can reach: same computer, LAN, or the internet |
| Knows about the other | Only the URL the visitor types in Advanced → *Your server URL* | Nothing; it just answers HTTP requests |
| Sends / receives | Sends the photo (and optional reference image), receives the result image | Receives images, returns one image |

A server can be written in any language. The reference implementation is `server/` in this
repository (Python, FastAPI).

## 2. Transport and browser rules

All endpoints are relative to the base URL the visitor enters, e.g. `http://localhost:8765`
(no trailing slash; the app removes one if present).

| Rule | Requirement |
| --- | --- |
| CORS | Every response, including preflight `OPTIONS`, must carry `Access-Control-Allow-Origin` with the page origin (`https://sywan.github.io`, plus `http://localhost:5173` / `4173` for development) or `*`. Allow methods `GET, POST, OPTIONS` and any request headers. |
| Private Network Access | When an HTTPS page calls `localhost` or a private IP, Chrome sends `Access-Control-Request-Private-Network: true` in the preflight. Answer with `Access-Control-Allow-Private-Network: true`. |
| Mixed content | Browsers allow an HTTPS page to call `http://localhost` / `http://127.0.0.1` (Chrome, Edge, Firefox). Any other host must be **HTTPS**. Safari also blocks `http://localhost`. |
| Credentials | The app sends no cookies or `Authorization` header. Protect a public server at the network level (VPN, Tailscale, firewall, reverse-proxy auth). |
| Timeouts | The app waits up to 6 s for `/api/engines` and 15 min for `/api/stylize`. |

## 3. Endpoints

### 3.1 `GET /api/health` (required)

```json
{ "ok": true, "api": "qute-server/1", "version": "0.4.1" }
```

`api` names the protocol version. `version` is your server's own version (optional).

### 3.2 `GET /api/engines` (required)

Lists the engines the server offers. The app calls it when the visitor presses **Connect** and
when the page loads with a saved server URL.

```json
{
  "engines": [
    { "id": "dctnet", "available": true, "variants": ["anime", "3d", "handdrawn", "sketch", "artstyle"] },
    { "id": "vtoonify", "available": false, "reason": "set VTOONIFY_DIR to a clone of williamyang1991/VToonify" },
    {
      "id": "my-model",
      "available": true,
      "label": { "en": "My portrait model", "zh-TW": "我的人像模型" },
      "description": { "en": "Trained on our lab's sketches.", "zh-TW": "以實驗室素描資料訓練。" },
      "citation": "Wan et al., 2026",
      "repo": "https://github.com/your/repo",
      "license": "MIT",
      "variants": ["soft", "strong"],
      "params": [
        { "name": "strength", "type": "number", "min": 0, "max": 1, "step": 0.05, "default": 0.7,
          "label": { "en": "Strength", "zh-TW": "強度" }, "help": { "en": "Higher is more stylised." } },
        { "name": "palette", "type": "select", "default": "warm",
          "options": [ { "value": "warm", "label": { "en": "Warm", "zh-TW": "暖色" } }, "cool" ] },
        { "name": "keep_background", "type": "boolean", "default": true, "label": "Keep background" },
        { "name": "prompt", "type": "text", "default": "", "label": "Extra prompt" }
      ]
    }
  ]
}
```

**Engine descriptor**

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | string | yes | Stable identifier, sent back in `/api/stylize`. Use lowercase letters, digits and `-`. |
| `available` | boolean | yes | `false` hides the engine from selection (shown disabled). |
| `reason` | string | no | Why it is unavailable; shown on the server's status page. |
| `variants` | string[] | no | Shown as a "Style weights" menu; the chosen value arrives as `params.variant`. |
| `label` | text | recommended | Display name. Strongly recommended for engines the app does not already know (§5); otherwise the `id` is shown. |
| `description` | text | no | One or two sentences under the menu. |
| `citation`, `repo`, `license` | string | no | Credit line; `repo` may be `owner/name` (GitHub) or a full URL. |
| `params` | param[] | no | Extra controls the app renders for this engine. |

*text* = a string, or an object of language codes (`"en"`, `"zh-TW"`); the app picks the visitor's
language and falls back to `en`.

**Parameter descriptor**

| Field | Applies to | Meaning |
| --- | --- | --- |
| `name` | all | Key in the `params` object sent to `/api/stylize`. |
| `type` | all | `number` (slider), `select` (menu), `boolean` (checkbox) or `text` (text box). Other types are ignored. |
| `label`, `help` | all | Text shown to the visitor (`help` appears on hover/tap). |
| `default` | all | Initial value. |
| `min`, `max`, `step` | number | Slider range (defaults 0, 1, 0.01). |
| `options` | select | Values as strings, or `{ "value": ..., "label": text }`. |

### 3.3 `POST /api/stylize` (required)

`Content-Type: multipart/form-data` with these fields:

| Field | Content |
| --- | --- |
| `engine` | The engine `id`. |
| `params` | JSON object as a string (see below). |
| `image` | The photo, PNG, longest side ≤ 1024 px, EXIF orientation already applied. |
| `reference` | Optional reference image, PNG, longest side ≤ 768 px, when the visitor chose one. |

`params` always contains the app's standard keys and, for engines described with `params`, the
visitor's values for those names:

| Key | Type | Used by built-in engines |
| --- | --- | --- |
| `variant` | string | chosen value from `variants` (`""` if none) |
| `style_degree` | number 0–1 | VToonify |
| `identity` | number 0.3–1.2 | InstantID chibi |
| `exaggeration` | number 0.2–2 | WarpGAN |
| `prompt` | string | InstantID chibi |
| *your names* | per descriptor | your engine |

Ignore keys you do not use.

**Responses**

| Status | Body | App shows |
| --- | --- | --- |
| 200 | The result image (`image/png` recommended; any format browsers display). Size may differ from the input. | The result |
| 400 | `{"detail": "..."}` bad request (unreadable image, invalid `params`) | "Server failed" |
| 404 | `{"detail": "unknown engine ..."}` | "Server failed" |
| 413 | `{"detail": "..."}` image too large | "Server failed" |
| 503 | `{"detail": "..."}` engine not available (missing weights etc.) | "Server failed" |
| 500 | `{"detail": "..."}` inference error | "Server failed" |

After the result arrives, the app may still apply the visitor's reference colours, brushwork and
soft grade to it in the browser.

### 3.4 `POST /api/warmup?engine=ID` (optional)

Loads an engine's weights before the first request. Returns `{"ok": true}` or 503. Not called by
the web app; useful for scripts.

### 3.5 `GET /` (optional)

A human-readable status page. The reference server lists each engine as READY or with its reason.

## 4. Privacy expectations

A server should process images in memory, delete temporary files after each request, and not log
image content. The web app tells visitors that, for server algorithms, the photo is sent to the
address they entered.

## 5. Built-in and custom engines

The app has translations and fixed controls for these ids: `dctnet`, `vtoonify`,
`instantid-chibi`, `warpgan`, `server-whitebox` (see `src/engines/registry.js`). A server that
offers them only needs `id`, `available` and, if relevant, `variants`.

Any other id is a **custom engine**. The app lists it under *Your server* with the tag "custom",
uses its `label`, `description` and credit fields, and renders its `params`. Custom engines are
removed from the menu when the visitor disconnects or the server stops advertising them.

## 6. Versioning

This document is `qute-server/1`. Future versions only add optional fields or endpoints; a server
that follows `qute-server/1` will keep working. A breaking change would use `qute-server/2`.

## 7. Building a server

### 7.1 Plugin for the Qute reference server (Python)

```python
from qute_server.engines.base import Engine

class MyModel(Engine):
    label = {"en": "My model", "zh-TW": "我的模型"}
    params = [{"name": "strength", "type": "number", "min": 0, "max": 1, "default": 0.7}]

    def __init__(self):
        super().__init__(id="my-model")

    def check(self):            # optional: report missing weights
        return True, ""

    def load(self):             # optional: called once, result passed to infer()
        return load_my_weights()

    def infer(self, model, image, reference, params):
        return run_my_model(model, image, strength=float(params.get("strength", 0.7)))  # PIL image

ENGINES = [MyModel()]
```

```sh
cd server
QUTE_PLUGINS=/path/to/my_plugin.py uvicorn qute_server.app:app --port 8765
```

The reference server adds CORS, Private Network Access, size limits, locking, the status page and
forwarding. Working example: [`server/examples/plugin_example.py`](../server/examples/plugin_example.py).

### 7.2 Your own server, any language

[`server/examples/minimal_server.py`](../server/examples/minimal_server.py) is a complete
one-file server (about 70 lines) that passes the checker. Port the same three endpoints and the
CORS rules to Node.js, Go or anything else.

### 7.3 Forwarding to another machine

The reference server can forward an engine to another `qute-server/1` server:

```sh
QUTE_REMOTE_ENGINES=my-model=http://gpu-box:8765 uvicorn qute_server.app:app --port 8765
```

## 8. Testing

```sh
python server/scripts/check_server.py http://localhost:8765            # all available engines
python server/scripts/check_server.py http://localhost:8765 --engine my-model
curl http://localhost:8765/api/engines
curl -F engine=my-model -F 'params={"strength":0.5}' -F image=@photo.png http://localhost:8765/api/stylize -o out.png
```

## 9. Troubleshooting

| Symptom in Qute | Likely cause | Fix |
| --- | --- | --- |
| "Could not connect" | Server not running, wrong port, or CORS/Private Network headers missing | Run the checker; open `<url>/api/health` in the browser |
| Works in Chrome, not in Safari or on a phone | Plain HTTP to a non-localhost address | Serve over HTTPS, or use an SSH tunnel so the server is `localhost` |
| Engine missing or greyed out in the menu | `available: false`, or the server was not re-connected after it changed | Check `/api/engines`, then press Connect again |
| "Server failed" after Transform | 4xx/5xx from `/api/stylize` | The `detail` message is in the browser console and server log |
