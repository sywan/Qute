# Qute v0.3.12

免登入的 React 照片風格轉換 App。介面提供**繁體中文與英文**切換，預設繁體中文。照片在訪客瀏覽器內處理，沒有 Qute 圖片伺服器，也不使用雲端 AI 額度。v0.3 起改為多演算法框架：訪客選擇「貼近原圖／更可愛／Q 版／強烈風格」，Qute 自動挑演算法與參數；另可連線自己部署的 Python 伺服器，使用 DCT-Net、VToonify、InstantID、WarpGAN。

## 定位：為什麼用 Qute？／Why Qute?

雲端大型 AI 影像模型（聊天助理與設計工具內建的影像生成）能把照片重新畫得很漂亮。Qute 刻意只做較單純的事：用在使用者自己裝置上執行的小型開源模型，為照片套用選定的畫風。成品通常不如雲端大模型精緻，但具備雲端服務做不到的特性：

- **隱私**：照片在瀏覽器內處理，不上傳
- **免費、免登入、不耗 AI 額度**：模型與執行環境首次下載（約 20–30 MB）後，轉換不再需要網路傳輸
- **忠於原照、可控制**：轉換原照而非重新創作；每一步可調整，相同設定得到相同結果
- **公開透明**：演算法皆有論文與原始碼出處，適合教學與方法比較
- **可升級**：需要更強效果時，自架 Qute 伺服器（DCT-Net、VToonify、InstantID、WarpGAN），仍不經雲端

Large cloud AI image models can redraw a photo beautifully. Qute deliberately does something narrower: it applies a chosen style to your photo with small open-source models running on your own device. Results are often less polished, but photos stay private, there is no account, cost or AI quota, the original composition is kept, every step is visible and repeatable, each algorithm is a published method, and a self-hosted server adds stronger models when needed. When you want a completely re-imagined picture and are comfortable uploading the photo, a cloud image generator will usually look better.

網站上的「為什麼用 Qute？」段落（頁首連結）含完整說明與比較表。

## 功能

- 電腦或手機透過瀏覽器授權相機並拍照、相簿上傳、拖放照片；拍照時可左右翻轉、套用預設或調整亮度、對比與飽和度
- **隨視窗寬度調整的版面**：寬螢幕（≥1500px）三欄：照片＋轉換按鈕｜效果目標＋參考圖｜進階設定；中等寬度兩欄，進階設定橫跨底部並分兩欄排列；手機單欄。滑桿說明改為滑過或點選時顯示
- **多種圖片格式**：JPEG、PNG、WebP、GIF、BMP、ICO、SVG、AVIF 由瀏覽器直接讀取；HEIC／HEIF（iPhone 照片）與 TIFF（含 LZW／Deflate、16 位元、多頁取第一頁）在瀏覽器不支援時，於本機自動轉換，不上傳；檔案上限 60 MB，超過 4,000 萬像素會先縮小
- **效果目標**：貼近原圖（White-box Cartoonization）、更可愛（AnimeGANv3＋大眼圓臉）、Q 版（大頭大眼短身變形＋AnimeGANv3；伺服器可用時改用 InstantID）、強烈風格（AnimeGANv3 Shinkai＋參考圖筆觸）
- **參考圖（選用）**：19 幅公有領域名畫（達文西、米開朗基羅、透納、葛飾北齋、歌川廣重、雷諾瓦、卡耶博特、秀拉、梵谷、孟克、塞尚、高更、雷頓、馬諦斯、莫內、克林姆、畢卡比亞、康丁斯基）或自選圖，以縮圖格狀排列；可分別調整「色彩」（Lab 色彩轉移，不塗抹）、「筆觸」（Magenta 風格遷移）與「臉部保護」
- **臉部與比例變形**：頭部放大、眼睛放大、**頭髮蓬鬆**（頭髮輪廓平順外擴，只作用於眉毛以上，紋理拉伸上限約 2 倍以保持自然）、**臉頰豐潤**（臉頰線條水平外擴，眼睛、鼻子、嘴巴不動；適合臉型偏瘦、下巴偏小者）、下巴內收、身體縮短；團體照中每人的變形範圍互不重疊
- **美肌**：磨皮（導向濾波，只作用於偵測到的臉部皮膚）、膚色亮白、唇色紅潤（避開牙齒）、豐唇；可單獨使用（「美肌」目標，不換畫風）或與任何效果合用
- **高解析輸出（2K / 4K / 5K）**：模型以「處理尺寸」運算後，用原照的全解析度作導向濾波放大（Fast Guided Filter），邊緣與細節清晰；輸出不超過原照解析度，超過 4.2 MP 時存為高品質 JPEG。
- **團體照**：放大頭部時，每個人的放大範圍不會蓋到旁邊的人，靠近畫面邊緣的頭也會留在畫面內；臉部偵測門檻放寬以找到較小或側面的臉
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
- **串接自己的模型或伺服器**：介面規格、自訂引擎（名稱、說明與參數會自動出現在 Qute）、範例與檢查程式見 [docs/SERVER_API.md](docs/SERVER_API.md)。

分享用 QR 碼（掃描即開啟 https://sywan.github.io/Qute/）：[public/brand/qute-qr-code.png](public/brand/qute-qr-code.png)，網站頁尾也有連結。

版本號：網頁標題旁與頁尾顯示的版本號來自 `package.json` 的 `version`（建置時由 `vite.config.js` 注入），每次更新時遞增；點選版本號可查看 GitHub 更新紀錄。

Vite 的 `base` 設為 `/Qute/`，輸出位於 `dist/`。推送至 `main` 後，GitHub Actions 會自動建置並將 `dist/` 發布到 GitHub Pages。網站：[https://sywan.github.io/Qute/](https://sywan.github.io/Qute/)。

## 來源與依賴

- [Magenta.js Arbitrary Style Transfer](https://magenta.github.io/magenta-js/image/classes/arbitrarystyletransfernetwork.html)，Apache-2.0；模型權重在首次使用參考圖筆觸時從 Magenta 官方儲存空間下載。
- [ONNX Runtime Web](https://onnxruntime.ai/)，MIT。
- [UTIF.js](https://github.com/photopea/UTIF.js)（TIFF 解碼），MIT；[libheif-js](https://github.com/catdad-experiments/libheif-js)（HEIC／HEIF 解碼，libheif），LGPL-3.0，僅在開啟 HEIC 檔時才載入。
- 瀏覽器模型來源與授權：[public/models/README.md](public/models/README.md)。
- 參考畫作（public/styles/，最長邊 800 px；縮圖 public/styles/thumbs/）：皆為公有領域作品（作者逝世逾 70 年、1929 年前發表）；平面藝術品的忠實翻拍不另產生著作權。

| 作品 | 作者／年代 | 圖檔來源 |
| --- | --- | --- |
| 蒙娜麗莎 Mona Lisa | 達文西，c. 1503–1519 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_Mona_Lisa.jpg) |
| 創造亞當 The Creation of Adam | 米開朗基羅，c. 1512 | GitHub taulant0/Paintings-and-Quotes-by-Michelangelo-Buonarroti |
| 米諾陶號船難 The Shipwreck of the Minotaur | 透納，c. 1810 | GitHub lengstrom/fast-style-transfer |
| 神奈川沖浪裏 The Great Wave off Kanagawa | 葛飾北齋，c. 1831 | GitHub joseamijares/frame-dashboard |
| 蒲原夜之雪 Evening Snow at Kanbara | 歌川廣重，1833–1834 | GitHub joseamijares/frame-dashboard |
| 煎餅磨坊的舞會 Dance at Le Moulin de la Galette | 雷諾瓦，1876 | GitHub Aces12345/becoming-plates |
| 巴黎街道，雨天 Paris Street; Rainy Day | 卡耶博特，1877 | GitHub joseamijares/frame-dashboard |
| 大碗島的星期天下午 A Sunday on La Grande Jatte | 秀拉，1884–1886 | GitHub joseamijares/frame-dashboard |
| 臥室 The Bedroom | 梵谷，1889 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Van_Gogh_-_The_Bedroom,_1889_Chicago.jpg) |
| 星夜 The Starry Night | 梵谷，1889 | GitHub jcjohnson/neural-style |
| 吶喊 The Scream | 孟克，1893 | GitHub jcjohnson/neural-style |
| 蘋果籃 The Basket of Apples | 塞尚，c. 1893 | GitHub joseamijares/frame-dashboard |
| 神之日 Mahana no Atua | 高更，1894 | GitHub joseamijares/frame-dashboard |
| 燃燒的六月 Flaming June | 雷頓，1895 | GitHub Aces12345/becoming-plates |
| 戴帽子的女人 Woman with a Hat | 馬諦斯，1905 | GitHub jcjohnson/neural-style |
| 睡蓮 Water Lilies | 莫內，1906 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Water_Lilies_-_1906,_Ryerson.jpg) |
| 吻 The Kiss | 克林姆，1907–1908 | GitHub inescoelho/the-kiss |
| Udnie | 畢卡比亞，1913 | GitHub pytorch/examples |
| 構成第八號 Composition VIII | 康丁斯基，1923 | GitHub akuji1993/generated-kandinsky |

照片內容不寫入倉庫、Qute 伺服器或 Magenta 模型儲存空間。

產品範圍與限制見 [v0.2 規格](docs/PRODUCT_SPEC_v0.2.md)、[v0.2.1 功能增補](docs/PRODUCT_SPEC_v0.2.1.md)、[v0.2.2 改進與 Q 版方案](docs/PRODUCT_SPEC_v0.2.2.md)及 [v0.3 多演算法框架](docs/PRODUCT_SPEC_v0.3.md)。
