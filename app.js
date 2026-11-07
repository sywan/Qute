const $ = (id) => document.getElementById(id);
const state = { image: null, name: "qute", fileName: "photo", stream: null, busy: false };
const styles = {
  qute: "Qute 插画",
  impression: "印象派",
  renaissance: "古典油画",
  modern: "现代主义",
  storybook: "绘本时光"
};
const sourcePreview = $("sourcePreview");
const resultCanvas = $("resultCanvas");
const resultContext = resultCanvas.getContext("2d", { willReadFrequently: true });
const sourceCanvas = document.createElement("canvas");
const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
let previewUrl = null;
let renderTimer = null;

function status(message) { $("status").textContent = message; }
function clamp(value) { return Math.max(0, Math.min(255, value)); }

async function readImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    status("请选择一张照片。");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    status("照片超过 20 MB，请选择较小的文件。");
    return;
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (state.image?.close) state.image.close();
    state.image = bitmap;
    state.fileName = file.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 50) || "photo";
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    sourcePreview.src = previewUrl;
    $("fileName").textContent = file.name;
    $("emptyState").hidden = true;
    $("previewState").hidden = false;
    $("cameraState").hidden = true;
    stopCamera();
    status("照片已载入。可切换画风，再下载结果。");
    render();
  } catch {
    status("浏览器无法读取这张照片。请试试 JPEG、PNG 或 WebP 格式。");
  }
}

function fitImage() {
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(state.image.width, state.image.height));
  const width = Math.max(1, Math.round(state.image.width * scale));
  const height = Math.max(1, Math.round(state.image.height * scale));
  sourceCanvas.width = resultCanvas.width = width;
  sourceCanvas.height = resultCanvas.height = height;
  sourceContext.drawImage(state.image, 0, 0, width, height);
}

function hashNoise(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

function quteEdge(gray, width, x, y) {
  const p = y * width + x;
  const left = gray[p - 1], right = gray[p + 1];
  const above = gray[p - width], below = gray[p + width];
  return Math.abs(left - right) + Math.abs(above - below);
}

function applyStyle() {
  const width = resultCanvas.width, height = resultCanvas.height;
  const original = sourceContext.getImageData(0, 0, width, height);
  const output = resultContext.createImageData(width, height);
  const src = original.data, dst = output.data;
  let gray;
  if (state.name === "qute") {
    gray = new Uint8Array(width * height);
    for (let p = 0; p < gray.length; p++) {
      const i = p * 4;
      gray[p] = src[i] * .3 + src[i + 1] * .59 + src[i + 2] * .11;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = src[i], g = src[i + 1], b = src[i + 2];
      const light = (r + g + b) / 3;
      const noise = hashNoise(x, y);
      switch (state.name) {
        case "qute": {
          const steps = 36;
          r = Math.round((light + (r - light) * 1.18) / steps) * steps + 7;
          g = Math.round((light + (g - light) * 1.12) / steps) * steps + 5;
          b = Math.round((light + (b - light) * 1.12) / steps) * steps + 8;
          if (x > 0 && y > 0 && x < width - 1 && y < height - 1 && quteEdge(gray, width, x, y) > 62) {
            r *= .47; g *= .44; b *= .48;
          }
          break;
        }
        case "impression": {
          r = light + (r - light) * 1.22 + 17 + noise * 10;
          g = light + (g - light) * 1.14 + 7 + noise * 8;
          b = light + (b - light) * 1.05 - 5 + noise * 8;
          const texture = Math.sin(x * .27 + y * .13) * 6;
          r += texture; g += texture; b += texture;
          break;
        }
        case "renaissance": {
          const warmth = r * .39 + g * .47 + b * .14;
          const dx = (x / width - .5) * 2, dy = (y / height - .5) * 2;
          const vignette = Math.max(.48, 1 - (dx * dx + dy * dy) * .3);
          r = (r * .55 + warmth * .45 + 15) * vignette + noise * 3;
          g = (g * .55 + warmth * .4 + 3) * vignette + noise * 3;
          b = (b * .5 + warmth * .29 - 10) * vignette + noise * 3;
          break;
        }
        case "modern": {
          const block = ((Math.floor(x / 82) + Math.floor(y / 82)) % 4);
          const shift = [9, -7, 4, -10][block];
          r = Math.round((light + (r - light) * 1.45 + shift) / 51) * 51;
          g = Math.round((light + (g - light) * 1.35 - shift) / 51) * 51;
          b = Math.round((light + (b - light) * 1.4 + shift * .5) / 51) * 51;
          break;
        }
        case "storybook": {
          r = (light + (r - light) * .72) * .81 + 52 + noise * 5;
          g = (light + (g - light) * .73) * .81 + 47 + noise * 5;
          b = (light + (b - light) * .78) * .82 + 51 + noise * 5;
          break;
        }
      }
      dst[i] = clamp(r); dst[i + 1] = clamp(g); dst[i + 2] = clamp(b);
      dst[i + 3] = src[i + 3];
    }
  }
  resultContext.putImageData(output, 0, 0);
}

function render() {
  if (!state.image || state.busy) return;
  state.busy = true;
  status("正在生成预览…");
  $("previewStyle").textContent = "· " + styles[state.name];
  requestAnimationFrame(() => setTimeout(() => {
    try {
      fitImage();
      applyStyle();
      status("预览已完成。图片仅保存在当前浏览器页面中。");
    } catch (error) {
      status("图片处理失败。请试试尺寸较小的照片。");
      console.error(error);
    } finally {
      state.busy = false;
    }
  }, 20));
}

function chooseStyle(button) {
  state.name = button.dataset.style;
  document.querySelectorAll(".style-option").forEach((option) => {
    const active = option === button;
    option.classList.toggle("selected", active);
    option.setAttribute("aria-checked", String(active));
  });
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 100);
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }
  $("cameraVideo").srcObject = null;
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    $("cameraInput").click();
    return;
  }
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    $("cameraVideo").srcObject = state.stream;
    $("emptyState").hidden = true;
    $("previewState").hidden = true;
    $("cameraState").hidden = false;
    status("相机已就绪。");
  } catch {
    status("无法打开相机；你仍可从相册选择照片。");
    $("cameraInput").click();
  }
}

function snap() {
  const video = $("cameraVideo");
  if (!video.videoWidth) return status("请等待相机画面出现。");
  const capture = document.createElement("canvas");
  capture.width = video.videoWidth;
  capture.height = video.videoHeight;
  capture.getContext("2d").drawImage(video, 0, 0);
  capture.toBlob((blob) => {
    if (!blob) return status("拍摄失败，请重试。");
    readImage(new File([blob], "qute-camera.jpg", { type: "image/jpeg" }));
  }, "image/jpeg", .94);
}

function resultBlob() {
  return new Promise((resolve) => resultCanvas.toBlob(resolve, "image/png"));
}

async function download() {
  if (!state.image || state.busy) return;
  const blob = await resultBlob();
  if (!blob) return status("无法保存图片，请重试。");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `qute-${state.fileName}-${state.name}.png`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  status("图片已准备下载。手机上请按浏览器提示保存。");
}

async function share() {
  if (!state.image || state.busy) return;
  const blob = await resultBlob();
  if (!blob) return status("无法分享图片，请重试。");
  const file = new File([blob], `qute-${state.name}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try { await navigator.share({ files: [file], title: "Qute 作品" }); }
    catch (error) { if (error.name !== "AbortError") status("分享未完成，你仍可下载图片。"); }
  } else {
    status("此浏览器不支持直接分享图片；请先下载，再使用手机的分享功能。");
  }
}

$("uploadButton").addEventListener("click", () => $("fileInput").click());
$("changeButton").addEventListener("click", () => $("fileInput").click());
$("cameraButton").addEventListener("click", openCamera);
$("cancelCamera").addEventListener("click", () => {
  stopCamera();
  $("cameraState").hidden = true;
  $(state.image ? "previewState" : "emptyState").hidden = false;
});
$("snapButton").addEventListener("click", snap);
$("downloadButton").addEventListener("click", download);
$("shareButton").addEventListener("click", share);
["fileInput", "cameraInput"].forEach((id) => $(id).addEventListener("change", (event) => {
  if (event.target.files?.[0]) readImage(event.target.files[0]);
  event.target.value = "";
}));
document.querySelectorAll(".style-option").forEach((button) => button.addEventListener("click", () => chooseStyle(button)));
const dropZone = document.querySelector(".workspace");
dropZone.addEventListener("dragover", (event) => event.preventDefault());
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  if (event.dataTransfer.files?.[0]) readImage(event.dataTransfer.files[0]);
});
window.addEventListener("pagehide", () => {
  stopCamera();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});
