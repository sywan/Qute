# Qute v0.3：多演算法風格框架與效果目標

## 目的

v0.2 只用 Magenta.js 任意風格遷移，自選參考圖（尤其 Q 版圖）常出現大片塗抹，也無法改變頭身比例。v0.3 改為可插拔的演算法框架：訪客先選「想要的效果」，Qute 自動挑演算法與參數；參考圖改為選用，並以較穩定的方式套用。

## 使用流程

1. 上傳、拖放或拍攝照片（同 v0.2.2）。
2. 選擇效果目標：**貼近原圖／更可愛／Q 版／強烈風格**。
3. 可選參考圖：不使用、三幅內建畫作、或自選參考圖。有參考圖時可調「參考圖色彩」「參考圖筆觸」「臉部保護」。
4. 「進階設定」可直接選演算法、變形程度、色調、細節保留、處理尺寸，以及自架伺服器網址。
5. 轉換、下載或分享。結果標示所用演算法與偵測到的臉數。

## 效果目標與預設

| 目標 | 演算法（瀏覽器） | 幾何變形（頭／眼／下巴／身體） | 參考圖預設 | 其他 |
| --- | --- | --- | --- | --- |
| 貼近原圖 | White-box Cartoonization | 0／0／0／0 | 色彩 35%、筆觸 0% | 細節保留 30% |
| 更可愛 | AnimeGANv3 Hayao | 35%／60%／50%／0 | 色彩 50% | 柔亮色調 60%、細節 10% |
| Q 版 | AnimeGANv3 Hayao；伺服器可用時改用 InstantID + Chibi LoRA | 100%／80%／60%／80% | 色彩 50% | 柔亮色調 40% |
| 強烈風格 | AnimeGANv3 Shinkai | 0 | 色彩 60%、筆觸 70%、臉部保護 70% | — |

「強烈風格」對應需求中的 more robust，解讀為畫風更鮮明；若原意是「結果更穩定」，建議改用「貼近原圖」（White-box，不依賴臉部偵測，對團體照、風景最穩定）。

## 處理管線（瀏覽器）

照片（最長邊 512／768／1024）→ YuNet 臉部偵測（需要變形或臉部保護時）→ 臉部變形（多個徑向放大／縮小場＋下巴以下垂直壓縮，反向映射＋雙線性取樣）→ 主演算法（ONNX Runtime Web）→ 參考圖筆觸（Magenta.js，臉部區域以羽化遮罩保留主演算法結果）→ 參考圖色彩（CIELAB 均值／標準差轉移，亮度權重減半）→ 柔亮色調 → 細節保留混合 → PNG。

## 自選參考圖品質改善

- 預設只借用色彩統計，不做紋理遷移，因此不會產生塗抹。
- 筆觸改在卡通化結果之上套用，且臉部保護預設 70–80%，避免臉被塗抹。
- 筆觸與色彩可分別調整，取代 v0.2.2 的單一風格強度。

## 演算法來源

| 演算法 | 執行位置 | 來源 | 授權 |
| --- | --- | --- | --- |
| White-box Cartoonization | 瀏覽器／伺服器 | SystemErrorWang/White-box-Cartoonization，由官方 TF checkpoint 轉 ONNX（誤差 2.4e-6） | CC BY-NC-SA 4.0 |
| AnimeGANv3 Hayao／Shinkai、AnimeGANv2 Shinkai | 瀏覽器 | TachibanaYoshino 官方 ONNX | 非商業 |
| YuNet | 瀏覽器 | opencv_zoo | MIT |
| Magenta 任意風格遷移 | 瀏覽器 | magenta-js | Apache-2.0 |
| DCT-Net | 自架伺服器 | ModelScope 官方 pipeline | 見模型卡 |
| VToonify | 自架伺服器 | 官方 style_transfer.py | S-Lab 1.0（非商業） |
| InstantID + IP-Adapter + SDXL + Chibi LoRA | 自架伺服器（GPU ≥12 GB） | InstantID 官方 pipeline | 各權重授權 |
| WarpGAN | 自架伺服器（TF 1.x） | 官方 test.py | MIT |

所有瀏覽器模型由 GitHub Pages 同源提供（共約 23 MB，用到才下載；ONNX Runtime wasm 約 14 MB，首次使用時下載並快取）。多數權重限非商業用途，Qute 商業化前須取得授權。

## 隱私

- 瀏覽器演算法：照片不離開瀏覽器。
- 伺服器演算法：照片只傳到訪客自行填入的伺服器網址；網址存於本機瀏覽器。伺服器在記憶體中處理，暫存檔於請求結束時刪除。
- Qute 本身仍無後端，不使用任何雲端 AI 額度。

## 已知限制

- 瀏覽器版 Q 版是臉部幾何變形＋動漫畫風，不是重新生成；側臉、低解析或被遮擋的臉可能偵測不到，此時不變形並提示。
- 身體縮短以最低的下巴為界，團體照中站位高低差大時，較高者的身體也會一起壓縮。
- 真正二頭身重繪需 InstantID 伺服器，只取最大的一張臉，可能出現生成幻覺（手指、背景）。
- Safari 與手機無法從 HTTPS 頁面呼叫 `http://localhost`；需將伺服器放在 HTTPS 之後。
- VToonify、WarpGAN 的呼叫參數依官方腳本；不同版本若參數不同，以 `.env` 調整。DCT-Net、VToonify、InstantID、WarpGAN 尚未在 GPU 機器上實測，部署後需以真實照片驗收。

## 驗收

- `npm test`：幾何變形、色彩轉移、臉部遮罩、YuNet 解碼單元測試。
- `cd server && python -m pytest`：API、CORS／Private Network、引擎可用性、InstantID 版面配置。
- 瀏覽器端到端：四種目標、內建參考圖色彩、自選參考圖、伺服器 White-box 均完成轉換。
