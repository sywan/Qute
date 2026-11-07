export const messages = {
  'zh-TW': {
    privacy:'照片只在你的瀏覽器處理',hero1:'把今天，',hero2:'畫下來。',lead:'拍一張照，選一幅參考畫作，讓 AI 將照片轉換成不一樣的作品。免登入，也不必把照片上傳到我們的伺服器。',
    noLogin:'免登入',neural:'神經風格轉換',local:'本機處理',studio:'開始創作',yourPhoto:'你的照片',noPhoto:'尚未選擇',uploadTitle:'從一張照片開始',uploadHelp:'支援 JPEG、PNG、WebP，以及瀏覽器可讀取的相簿照片',choosePhoto:'選擇照片',openCamera:'開啟相機',dropHint:'也可以拖放照片到這裡',
    original:'原圖',result:'轉換結果',changePhoto:'更換照片',download:'下載作品',share:'分享圖片',chooseStyle:'選擇參考畫作',styleIntro:'具體作品，帶來更鮮明的筆觸與色彩',
    vanGogh:'梵谷 · 臥室',vanGoghDesc:'鮮明色彩與富表現力的筆觸',monet:'莫奈 · 睡蓮',monetDesc:'柔和光線與印象派色彩',daVinci:'達文西 · 蒙娜麗莎',daVinciDesc:'古典色調與柔和明暗',custom:'自選參考圖',customDesc:'用你有權使用的作品作參考',chooseReference:'選擇參考圖片',customSelected:'已選擇參考圖片',
    strength:'風格強度',gentle:'柔和',bold:'鮮明',generate:'用 AI 轉換照片',regenerate:'重新轉換',
    aiNotice:'首次使用需下載模型；執行時間依裝置而異。神經風格遷移會改變色彩與筆觸，但不會把真人重畫成大頭身 Q 版。',
    artistNotice:'宮崎駿等在世創作者的作品未作為預設素材；如有權使用參考圖片，可透過「自選參考圖」嘗試。結果不代表藝術家參與或授權。',
    modelSource:'使用 Magenta.js 的開放模型，在瀏覽器內運算。',
    how1:'簡單三步，',how2:'留下不一樣的回憶。',step1:'拍照或選擇相簿照片',step2:'選擇畫家作品或自己的參考圖',step3:'用 AI 轉換，下載或分享',footer:'為值得珍藏的時刻而做。',
    ready:'照片已載入。選擇參考畫作，再按「用 AI 轉換照片」。',missingPhoto:'請先選擇照片。',missingStyle:'請先選擇參考圖片。',tooLarge:'圖片超過 20 MB，請選擇較小的檔案。',badFormat:'瀏覽器無法讀取這張圖片，請試試 JPEG、PNG 或 WebP。',
    loadingModel:'首次使用：正在下載並載入 AI 模型，可能需要一些時間…',generating:'AI 正在轉換照片，請稍候…',done:'轉換完成。圖片只保存在目前瀏覽器頁面中。',failed:'AI 轉換失敗。請確認網路連線，或換一張較小的照片再試。',
    cameraReady:'相機已準備好。',cameraFailed:'無法開啟相機，你仍可從相簿選擇照片。',cancel:'取消',snap:'拍攝照片',waitCamera:'請等候相機畫面出現。',noResult:'請先完成轉換。',downloadReady:'圖片已準備下載。',shareUnavailable:'此瀏覽器無法直接分享圖片；請先下載，再使用裝置的分享功能。',shareFailed:'分享未完成，你仍可下載圖片。'
  },
  en: {
    privacy:'Your photos stay in your browser',hero1:'Make today',hero2:'a work of art.',lead:'Take a photo, choose a reference painting, and let AI restyle your moment. No account, and no upload to our server.',
    noLogin:'No account',neural:'Neural style transfer',local:'On-device processing',studio:'Create something',yourPhoto:'Your photo',noPhoto:'Nothing selected',uploadTitle:'Start with a photo',uploadHelp:'JPEG, PNG, WebP, and photos your browser can open',choosePhoto:'Choose photo',openCamera:'Open camera',dropHint:'Or drop a photo here',
    original:'Original',result:'Your artwork',changePhoto:'Change photo',download:'Download',share:'Share image',chooseStyle:'Choose a reference artwork',styleIntro:'Specific paintings give the result a clearer artistic direction',
    vanGogh:'Van Gogh · The Bedroom',vanGoghDesc:'Expressive color and brushwork',monet:'Monet · Water Lilies',monetDesc:'Soft light and Impressionist color',daVinci:'Da Vinci · Mona Lisa',daVinciDesc:'Classical tones and soft shading',custom:'Your own reference',customDesc:'Choose an image you have rights to use',chooseReference:'Choose reference image',customSelected:'Reference image selected',
    strength:'Style strength',gentle:'Subtle',bold:'Bold',generate:'Transform with AI',regenerate:'Transform again',
    aiNotice:'The model downloads on first use. Processing time varies by device. Neural style transfer changes color and texture; it does not redraw people into chibi characters.',
    artistNotice:'Works by living creators such as Hayao Miyazaki are not bundled. If you have permission to use a reference image, try Your own reference. Results are not endorsed by the artist.',
    modelSource:'Runs in your browser with the open Magenta.js model.',
    how1:'Three simple steps,',how2:'a different kind of memory.',step1:'Take or choose a photo',step2:'Pick an artwork or your own reference',step3:'Transform, download, or share',footer:'Made for moments worth keeping.',
    ready:'Photo ready. Choose a reference and select Transform with AI.',missingPhoto:'Choose a photo first.',missingStyle:'Choose a reference image first.',tooLarge:'This image is over 20 MB. Please choose a smaller one.',badFormat:'Your browser could not open this image. Try JPEG, PNG, or WebP.',
    loadingModel:'Downloading and loading the AI model for the first time…',generating:'AI is restyling your photo…',done:'Done. Your image stays in this browser page.',failed:'Style transfer failed. Check your connection or try a smaller photo.',
    cameraReady:'Camera ready.',cameraFailed:'The camera could not open. You can still choose a photo.',cancel:'Cancel',snap:'Take photo',waitCamera:'Waiting for the camera preview.',noResult:'Transform your photo first.',downloadReady:'Your image is ready to download.',shareUnavailable:'Sharing images is not supported here. Download the image and share it from your device.',shareFailed:'Sharing did not finish. You can still download the image.'
  }
};
export function initialLanguage() {
  const saved = localStorage.getItem('qute-language');
  if (saved === 'zh-TW' || saved === 'en') return saved;
  return 'zh-TW';
}
