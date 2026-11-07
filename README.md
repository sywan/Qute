# Qute v0.2

免登入的 React 照片風格轉換 App。介面提供**繁體中文與英文**切換，預設繁體中文。照片在訪客瀏覽器內處理；第一次按「用 AI 轉換」時下載 Magenta.js 神經風格遷移模型，沒有 Qute 圖片伺服器。

## 功能

- 電腦或手機拍照、相簿上傳、拖放照片
- 梵谷《臥室》、莫奈《睡蓮》、達文西《蒙娜麗莎》三幅具體作品作為參考
- 自選參考圖與風格強度調整
- 瀏覽器內神經風格遷移、PNG 下載、裝置支援時系統分享
- 繁體中文／英文切換；選擇記錄在本機瀏覽器

模型會轉移畫作的色彩與紋理，**不會**將真人重新生成為大頭身 Q 版，也無法保證團體照中每張臉的細節。宮崎駿等在世創作者的作品未內建；自選參考圖應由使用者確認使用權。

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

產品範圍與限制見 [v0.2 規格](docs/PRODUCT_SPEC_v0.2.md)。
