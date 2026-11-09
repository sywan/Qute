# Qute v0.3.4

免登入的 React 照片風格轉換 App。介面提供**繁體中文與英文**切換，預設繁體中文。照片在訪客瀏覽器內處理，沒有 Qute 圖片伺服器，也不使用雲端 AI 額度。v0.3 起改為多演算法框架：訪客選擇「貼近原圖／更可愛／Q 版／強烈風格」，Qute 自動挑演算法與參數；另可連線自己部署的 Python 伺服器，使用 DCT-Net、VToonify、InstantID、WarpGAN。

## 功能

- 電腦或手機透過瀏覽器授權相機並拍照、相簿上傳、拖放照片；拍照時可左右翻轉、套用預設或調整亮度、對比與飽和度
- **隨視窗寬度調整的版面**：寬螢幕（≥1500px）三欄：照片＋轉換按鈕｜效果目標＋參考圖｜進階設定；中等寬度兩欄，進階設定橫跨底部並分兩欄排列；手機單欄。滑桿說明改為滑過或點選時顯示
- **多種圖片格式**：JPEG、PNG、WebP、GIF、BMP、ICO、SVG、AVIF 由瀏覽器直接讀取；HEIC／HEIF（iPhone 照片）與 TIFF（含 LZW／Deflate、16 位元、多頁取第一頁）在瀏覽器不支援時，於本機自動轉換，不上傳；檔案上限 60 MB，超過 4,000 萬像素會先縮小
- **效果目標**：貼近原圖（White-box Cartoonization）、更可愛（AnimeGANv3＋大眼圓臉）、Q 版（大頭大眼短身變形＋AnimeGANv3；伺服器可用時改用 InstantID）、強烈風格（AnimeGANv3 Shinkai＋參考圖筆觸）
- **參考圖（選用）**：三幅公有領域畫作或自選圖；可分別調整「色彩」（Lab 色彩轉移，不塗抹）、「筆觸」（Magenta 風格遷移）與「臉部保護」
- **自訂**目標：全部步驟預設關閉，由「進階設定」逐項開啟；轉換按鈕上方即時顯示「本次轉換會依序執行」的步驟摘要（例如：臉部變形 → White-box → 參考圖色彩 50% → 柔亮色調 40%）
- 切換參考圖開／關只調整參考圖色彩與筆觸，其他進階設定保留；連線伺服器時只在演算法未被手動更改時才改用 InstantID
- **進階設定**：直接選演算法、頭／眼／下巴／身體變形、柔亮色調、細節保留、處理尺寸；自架伺服器網址
- 瀏覽器內推論：ONNX Runtime Web 執行 AnimeGANv2／v3、White-box、YuNet 臉部偵測；模型與 wasm 由本站提供
- PNG 下載、裝置支援時系統分享；繁中／英文切換

| 演算法 | 執行位置 | 論文 |
| --- | --- | --- |
| White-box Cartoonization | 瀏覽器／伺服器 | Wang & Yu, CVPR 2020 |
| AnimeGANv2／v3 | 瀏覽器 | Chen et al., ISICA 2019（Springer CCIS 1205, 2020） |
| YuNet 臉部偵測＋Q 版幾何變形 | 瀏覽器 | Wu et al., Machine Intelligence Research 2023 |
| Magenta 任意風格遷移 | 瀏覽器 | Ghiasi et al., BMVC 2017 |
| DCT-Net | 自架伺服器 | Men et al., ACM TOG 2022 |
| VToonify | 自架伺服器 | Yang et al., ACM TOG 2022 |
| InstantID＋IP-Adapter＋Chibi LoRA | 自架伺服器（GPU） | Wang et al., 2024；Ye et al., 2023 |
| WarpGAN | 自架伺服器 | Shi et al., CVPR 2019 |

瀏覽器版 Q 版是臉部幾何變形加動漫畫風，不是重新生成；真正的二頭身重繪需要 InstantID 伺服器（見 [server/README.md](server/README.md)）。多數模型權重限**非商業用途**，詳見 [public/models/README.md](public/models/README.md)。宮崎駿等在世創作者的作品未內建；自選參考圖應由使用者確認使用權。

相機使用瀏覽器的 `getUserMedia`，只在使用者按「開啟相機／重新拍照」時請求權限。GitHub Pages 的 HTTPS 網址符合瀏覽器安全環境要求。預覽中可調整左右翻轉與影像色彩，拍下的 JPEG 也會套用同樣設定。若權限被拒、找不到裝置或相機被占用，頁面會顯示對應提示；拍照或取消後會停止攝影機串流。

## 開發

```sh
npm ci
npm run dev
npm run build
npm test                      # 前端純函式單元測試

cd server                     # 選用：自架推論伺服器（測試）
pip install -r requirements-dev.txt
python -m pytest -q tests
```

自架 GPU 伺服器（DCT-Net、VToonify、InstantID＋Chibi LoRA、WarpGAN、White-box）：

- Linux＋NVIDIA：`cd server/deploy/linux && cp .env.example .env && docker compose up -d --build`
- Apple Silicon Mac：`cd server && ./deploy/mac/setup.sh && ./deploy/mac/run.sh`
- 詳見 [server/README.md](server/README.md)；連線後在 Qute「進階設定」輸入 `http://localhost:8765`。

Vite 的 `base` 設為 `/Qute/`，輸出位於 `dist/`。推送至 `main` 後，GitHub Actions 會自動建置並將 `dist/` 發布到 GitHub Pages。網站：[https://sywan.github.io/Qute/](https://sywan.github.io/Qute/)。

## 來源與依賴

- [Magenta.js Arbitrary Style Transfer](https://magenta.github.io/magenta-js/image/classes/arbitrarystyletransfernetwork.html)，Apache-2.0；模型權重在首次使用參考圖筆觸時從 Magenta 官方儲存空間下載。
- [ONNX Runtime Web](https://onnxruntime.ai/)，MIT。
- [UTIF.js](https://github.com/photopea/UTIF.js)（TIFF 解碼），MIT；[libheif-js](https://github.com/catdad-experiments/libheif-js)（HEIC／HEIF 解碼，libheif），LGPL-3.0，僅在開啟 HEIC 檔時才載入。
- 瀏覽器模型來源與授權：[public/models/README.md](public/models/README.md)。
- 梵谷《臥室》：[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Van_Gogh_-_The_Bedroom,_1889_Chicago.jpg)
- 莫奈《睡蓮》：[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Water_Lilies_-_1906,_Ryerson.jpg)
- 達文西《蒙娜麗莎》：[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_Mona_Lisa.jpg)

三幅畫作的縮圖已儲存在倉庫內，來源頁面標示為公有領域。照片內容不寫入倉庫、Qute 伺服器或 Magenta 模型儲存空間。

產品範圍與限制見 [v0.2 規格](docs/PRODUCT_SPEC_v0.2.md)、[v0.2.1 功能增補](docs/PRODUCT_SPEC_v0.2.1.md)、[v0.2.2 改進與 Q 版方案](docs/PRODUCT_SPEC_v0.2.2.md)及 [v0.3 多演算法框架](docs/PRODUCT_SPEC_v0.3.md)。
