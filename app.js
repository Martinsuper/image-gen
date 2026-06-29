const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const fileList = document.querySelector("#fileList");
const template = document.querySelector("#fileItemTemplate");
const sourceCanvas = document.querySelector("#sourceCanvas");
const resultCanvas = document.querySelector("#resultCanvas");
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
const resultCtx = resultCanvas.getContext("2d", { willReadFrequently: true });
const activeName = document.querySelector("#activeName");
const imageMeta = document.querySelector("#imageMeta");
const previewPanel = document.querySelector(".preview-panel");
const strength = document.querySelector("#strength");
const strengthValue = document.querySelector("#strengthValue");
const keepAlpha = document.querySelector("#keepAlpha");
const renameFiles = document.querySelector("#renameFiles");
const vectorColors = document.querySelector("#vectorColors");
const traceOriginalColor = document.querySelector("#traceOriginalColor");
const downloadCurrent = document.querySelector("#downloadCurrent");
const downloadAll = document.querySelector("#downloadAll");
const clearQueue = document.querySelector("#clearQueue");

const state = {
  items: [],
  activeId: null,
  renderId: 0,
  isDownloading: false,
};

const modeInputs = [...document.querySelectorAll('input[name="mode"]')];
const formatInputs = [...document.querySelectorAll('input[name="format"]')];

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  addFiles(event.dataTransfer.files);
});

strength.addEventListener("input", handlePreviewOptionChange);

[keepAlpha, ...modeInputs].forEach((input) => {
  input.addEventListener("change", handlePreviewOptionChange);
});

[renameFiles, vectorColors, traceOriginalColor, ...formatInputs].forEach((input) => {
  input.addEventListener("change", updateActions);
});

downloadCurrent.addEventListener("click", async () => {
  const item = getActiveItem();
  if (!item || state.isDownloading) return;
  await runDownload(() => downloadItem(item));
});

downloadAll.addEventListener("click", async () => {
  if (!state.items.length || state.isDownloading) return;
  await runDownload(async () => {
    for (const item of state.items) {
      await downloadItem(item);
    }
  });
});

clearQueue.addEventListener("click", () => {
  state.items.forEach((item) => URL.revokeObjectURL(item.url));
  state.items = [];
  state.activeId = null;
  sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
  activeName.textContent = "还没有选择图片";
  imageMeta.textContent = "等待导入";
  previewPanel.classList.remove("has-image");
  renderQueue();
  updateActions();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

updateActions();

function addFiles(fileLikeList) {
  const files = [...fileLikeList].filter((file) => file.type.startsWith("image/"));
  const items = files.map((file) => ({
    id: createId(),
    file,
    url: URL.createObjectURL(file),
    image: null,
  }));

  state.items.push(...items);
  if (!state.activeId && items.length) {
    state.activeId = items[0].id;
  }

  renderQueue();
  updateActions();
  renderActive();
}

function getActiveItem() {
  return state.items.find((item) => item.id === state.activeId);
}

async function renderActive() {
  const item = getActiveItem();
  if (!item) return;

  const renderId = ++state.renderId;
  const image = await loadImage(item);
  if (renderId !== state.renderId || item.id !== state.activeId) return;

  drawImageToCanvas(image, sourceCanvas, sourceCtx);
  drawImageToCanvas(image, resultCanvas, resultCtx);
  applyGrayscale(resultCanvas, resultCtx, getProcessingOptions());

  activeName.textContent = item.file.name;
  imageMeta.textContent = `${image.naturalWidth} x ${image.naturalHeight} · ${formatBytes(item.file.size)}`;
  previewPanel.classList.add("has-image");
}

function renderQueue() {
  fileList.replaceChildren();

  state.items.forEach((item) => {
    const fragment = template.content.cloneNode(true);
    const button = fragment.querySelector(".file-item");
    const thumb = fragment.querySelector(".file-thumb");
    const name = fragment.querySelector(".file-name");
    const size = fragment.querySelector(".file-size");

    button.classList.toggle("is-active", item.id === state.activeId);
    button.addEventListener("click", () => {
      state.activeId = item.id;
      renderQueue();
      renderActive();
    });

    thumb.style.backgroundImage = `url("${item.url}")`;
    name.textContent = item.file.name;
    size.textContent = formatBytes(item.file.size);
    fileList.append(fragment);
  });
}

function updateActions() {
  const hasItems = state.items.length > 0;
  const format = getSelectedFormatLabel();

  downloadCurrent.textContent = `下载 ${format}`;
  downloadAll.textContent = `批量下载 ${format}`;
  downloadCurrent.disabled = !hasItems || state.isDownloading;
  downloadAll.disabled = !hasItems || state.isDownloading;
  clearQueue.disabled = !hasItems || state.isDownloading;
}

function loadImage(item) {
  if (item.image) return Promise.resolve(item.image);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      item.image = image;
      resolve(image);
    };
    image.onerror = reject;
    image.src = item.url;
  });
}

function drawImageToCanvas(image, canvas, context) {
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
}

function applyGrayscale(canvas, context, options = getProcessingOptions()) {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const { amount, mode, preserveAlpha } = options;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const gray = getGrayValue(red, green, blue, mode);

    data[index] = mix(red, gray, amount);
    data[index + 1] = mix(green, gray, amount);
    data[index + 2] = mix(blue, gray, amount);

    if (!preserveAlpha) {
      data[index + 3] = 255;
    }
  }

  context.putImageData(imageData, 0, 0);
}

function getGrayValue(red, green, blue, mode) {
  if (mode === "average") {
    return Math.round((red + green + blue) / 3);
  }

  if (mode === "desaturate") {
    return Math.round((Math.max(red, green, blue) + Math.min(red, green, blue)) / 2);
  }

  return Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
}

function mix(original, target, amount) {
  return Math.round(original + (target - original) * amount);
}

async function downloadItem(item) {
  const image = await loadImage(item);
  const canvas = createProcessedCanvas(image);
  const format = getSelectedFormat();
  const vectorSourceCanvas =
    format === "svg-vector" && traceOriginalColor.checked ? createSourceCanvas(image) : canvas;
  const blob = await createExportBlob(canvas, vectorSourceCanvas, item.file.name, format);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = getOutputName(item.file.name, format);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function createExportBlob(canvas, vectorSourceCanvas, fileName, format) {
  if (format === "svg-embed") {
    return createEmbeddedSvgBlob(canvas, fileName);
  }

  if (format === "svg-vector") {
    return createVectorSvgBlob(vectorSourceCanvas, fileName);
  }

  return createPngBlob(canvas);
}

function createSourceCanvas(image) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  drawImageToCanvas(image, canvas, context);

  return canvas;
}

function createProcessedCanvas(image) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  drawImageToCanvas(image, canvas, context);
  applyGrayscale(canvas, context, getProcessingOptions());

  return canvas;
}

function createPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("PNG export failed."));
      }
    }, "image/png");
  });
}

function createEmbeddedSvgBlob(canvas, fileName) {
  const title = escapeXml(fileName.replace(/\.[^.]+$/, ""));
  const dataUrl = canvas.toDataURL("image/png");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" preserveAspectRatio="xMidYMid meet" overflow="hidden" role="img" aria-label="${title}">
  <title>${title}</title>
  <image x="0" y="0" width="${canvas.width}" height="${canvas.height}" href="${dataUrl}" xlink:href="${dataUrl}" preserveAspectRatio="none"/>
</svg>
`;

  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

function createVectorSvgBlob(canvas, fileName) {
  const imageTracer = getImageTracer();

  if (!imageTracer) {
    throw new Error("Vector tracer is not available.");
  }

  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const colorCount = Number(vectorColors.value);
  const svg = imageTracer.imagedataToSVG(imageData, {
    colorsampling: 0,
    colorquantcycles: colorCount >= 32 ? 3 : 2,
    numberofcolors: colorCount,
    pathomit: colorCount >= 32 ? 1 : 3,
    ltres: colorCount >= 32 ? 0.5 : 1,
    qtres: colorCount >= 32 ? 0.5 : 1,
    rightangleenhance: true,
    linefilter: true,
    strokewidth: 0,
    scale: 1,
    roundcoords: 1,
    viewbox: true,
    desc: false,
  });
  const title = `<title>${escapeXml(fileName.replace(/\.[^.]+$/, ""))}</title>`;
  const labeledSvg = svg.replace(/<svg\b([^>]*)>/, `<svg$1 role="img">${title}`);

  return new Blob([labeledSvg], { type: "image/svg+xml;charset=utf-8" });
}

function getImageTracer() {
  return globalThis.ImageTracer ?? window.ImageTracer ?? self.ImageTracer;
}

function getSelectedFormat() {
  return formatInputs.find((input) => input.checked)?.value ?? "png";
}

function getSelectedFormatLabel() {
  const labels = {
    png: "PNG",
    "svg-embed": "SVG 嵌入图",
    "svg-vector": "SVG 路径描摹",
  };

  return labels[getSelectedFormat()] ?? "PNG";
}

function getProcessingOptions() {
  return {
    amount: Number(strength.value) / 100,
    mode: modeInputs.find((input) => input.checked)?.value ?? "luma",
    preserveAlpha: keepAlpha.checked,
  };
}

function getOutputName(fileName, format = getSelectedFormat()) {
  const cleanName = fileName.replace(/\.[^.]+$/, "");
  const suffix = renameFiles.checked ? "_gray" : "";
  const extension = format.startsWith("svg") ? "svg" : "png";
  const modeSuffix = format === "svg-vector" ? "_vector" : "";

  return `${cleanName}${suffix}${modeSuffix}.${extension}`;
}

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (character) => {
    const entities = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      "\"": "&quot;",
    };

    return entities[character];
  });
}

async function runDownload(callback) {
  try {
    state.isDownloading = true;
    updateActions();
    await callback();
  } finally {
    state.isDownloading = false;
    updateActions();
  }
}

function handlePreviewOptionChange() {
  strengthValue.value = `${strength.value}%`;
  renderActive();
}

function createId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
