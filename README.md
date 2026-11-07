# Qute v0.2.2

免登入的 React 照片風格轉換 App。介面提供**繁體中文與英文**切換，預設繁體中文。照片在訪客瀏覽器內處理；第一次按「用 AI 轉換」時下載 Magenta.js 神經風格遷移模型，沒有 Qute 圖片伺服器。

## 功能

- 電腦或手機透過瀏覽器授權相機並拍照、相簿上傳、拖放照片；可重新拍照。拍照時可左右翻轉，套用自然、明亮、鮮豔、柔和預設，或自行調整亮度、對比與飽和度
- 梵谷《臥室》、莫奈《睡蓮》、達文西《蒙娜麗莎》三幅具體作品作為參考
- 自選參考圖可拖放或選擇檔案，並提供預覽、風格強度與原照細節保留調整
- 瀏覽器內神經風格遷移、PNG 下載、裝置支援時系統分享
- 繁體中文／英文切換；選擇記錄在本機瀏覽器

模型會轉移畫作的色彩與紋理。自選參考圖改用較低的預設風格強度，並可混合部分原照以減少大片塗抹、保留人臉；先前的二次轉換已移除，因為它可能放大塗抹問題。**這仍不會將真人重新生成為大頭身 Q 版**，也無法保證團體照中每張臉的細節。真正的 Q 版重繪需要另行設計生成式影像模型與推論環境，不能靠目前的靜態 GitHub Pages 加上這個風格遷移模型保證完成。宮崎駿等在世創作者的作品未內建；自選參考圖應由使用者確認使用權。

相機使用瀏覽器的 `getUserMedia`，只在使用者按「開啟相機／重新拍照」時請求權限。GitHub Pages 的 HTTPS 網址符合瀏覽器安全環境要求。預覽中可調整左右翻轉與影像色彩，拍下的 JPEG 也會套用同樣設定。若權限被拒、找不到裝置或相機被占用，頁面會顯示對應提示；拍照或取消後會停止攝影機串流。

## 開發

```sh
npm ci
npm run dev
npm run build
```

Vite 的 `base` 設為 `/Qute/`，輸出位於 `dist/`。推送至 `main` 後，GitHub Actions 會自動建置並將 `dist/` 發布到 GitHub Pages。網站：[https://sywan.github.io/Qute/](https://sywan.github.io/Qute/)。

## 來源與依賴

- [Magenta.js Arbitrary Style Transfer](https://magenta.github.io/magenta-js/image/classes/arbitrarystyletransfernetwork.html)，Apache-2.0；模型權重在首次使用時從 Magenta 官方儲存空間下載。
- 梵谷《臥室》：[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Van_Gogh_-_The_Bedroom,_1889_Chicago.jpg)
- 莫奈《睡蓮》：[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Water_Lilies_-_1906,_Ryerson.jpg)
- 達文西《蒙娜麗莎》：[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_Mona_Lisa.jpg)

三幅畫作的縮圖已儲存在倉庫內，來源頁面標示為公有領域。照片內容不寫入倉庫、Qute 伺服器或 Magenta 模型儲存空間。

產品範圍與限制見 [v0.2 規格](docs/PRODUCT_SPEC_v0.2.md)、[v0.2.1 功能增補](docs/PRODUCT_SPEC_v0.2.1.md)及 [v0.2.2 改進與 Q 版方案](docs/PRODUCT_SPEC_v0.2.2.md)。
