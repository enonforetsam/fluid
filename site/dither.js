const $ = (id) => document.getElementById(id);
const ids = ['Algorithm', 'Size', 'Brightness', 'Contrast', 'Threshold', 'Ink', 'Paper', 'Invert'];
const controls = Object.fromEntries(ids.map((key) => [key, $('dither' + key)]));
const canvas = $('ditherArt');
const context = canvas.getContext('2d');
const preview = $('ditherPreview');
const previewContext = preview.getContext('2d');
const scratch = document.createElement('canvas');
const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
const palettes = {
  paper: ['#18191b', '#f1efeb'], terminal: ['#a4ff9a', '#142319'],
  cobalt: ['#243cba', '#f5eedb'], peach: ['#ff916a', '#241e25']
};
const descriptions = {
  ordered4: 'A repeating grid with a classic printed texture.',
  ordered8: 'A finer ordered pattern with more steps between light and dark.',
  floyd: 'Even, scattered grain that keeps the detail in your image.',
  atkinson: 'Light, airy dots with the feel of an early Macintosh.',
  threshold: 'Two clean tones. No grain, just light and shadow.'
};
const defaults = { Algorithm: 'ordered4', Size: '3', Brightness: '0', Contrast: '0', Threshold: '128', Ink: palettes.paper[0], Paper: palettes.paper[1], Invert: false };
let source = null;
let sourceUrl = null;
let sourceName = 'anthurium';
let sourceVersion = 0;
let version = 0;
let renderedVersion = -1;
let workerBusy = false;
let renderTimer;
let busyTimer;
let workerFailed = false;
let renderFailed = false;
let exporting = false;
let loadPending = false;
let dragDepth = 0;
let outputWidth = 0;
let outputHeight = 0;
let compare = false;
const worker = new Worker(new URL('./dither-worker.js', import.meta.url), { type: 'module' });

function announce(message) { $('ditherStatus').textContent = message; }
function showError(message) { $('ditherError').textContent = message; $('ditherError').hidden = !message; }
function setReadyState() {
  const waiting = loadPending || (Boolean(source) && !workerFailed && !renderFailed && (workerBusy || renderedVersion !== version));
  $('ditherEditor').setAttribute('aria-busy', String(waiting));
  $('ditherExport').disabled = !source || waiting || workerFailed || renderFailed || exporting;
  $('ditherCompare').disabled = !source || renderedVersion < 0;
  if (!source) $('ditherExportNote').textContent = 'Upload an image or use the sample to get started.';
  else if (workerFailed) $('ditherExportNote').textContent = 'Reload this page to restart the dither engine.';
  else if (renderFailed) $('ditherExportNote').textContent = 'Reset the controls or choose another image to try again.';
  else if (waiting) $('ditherExportNote').textContent = 'Updating your dither. Export will be ready in a moment.';
  else $('ditherExportNote').textContent = outputWidth + ' × ' + outputHeight + ' px · PNG with transparency preserved.';
}
// Downsample the screen preview in half-size steps to avoid aliasing fine grids.
// The full-resolution canvas remains untouched for PNG export.
function drawPreview() {
  if (renderedVersion < 0) return;
  const stage = $('ditherStage');
  const density = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(stage.clientWidth * density));
  const height = Math.max(1, Math.round(stage.clientHeight * density));
  preview.width = width;
  preview.height = height;
  let image = canvas;
  while (image.width > width * 2 && image.height > height * 2) {
    const smaller = document.createElement('canvas');
    smaller.width = Math.max(width, Math.ceil(image.width / 2));
    smaller.height = Math.max(height, Math.ceil(image.height / 2));
    const smallerContext = smaller.getContext('2d');
    smallerContext.imageSmoothingEnabled = true;
    smallerContext.imageSmoothingQuality = 'high';
    smallerContext.drawImage(image, 0, 0, smaller.width, smaller.height);
    image = smaller;
  }
  previewContext.imageSmoothingEnabled = width < canvas.width;
  previewContext.imageSmoothingQuality = 'high';
  previewContext.drawImage(image, 0, 0, width, height);
}
const previewObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(drawPreview) : null;
previewObserver?.observe($('ditherStage'));
window.addEventListener('resize', drawPreview);
function readOptions() {
  return { algorithm: controls.Algorithm.value, foreground: controls.Ink.value, background: controls.Paper.value,
    brightness: Number(controls.Brightness.value), contrast: Number(controls.Contrast.value),
    threshold: Number(controls.Threshold.value), invert: controls.Invert.checked };
}
function refreshControls() {
  for (const key of ['Brightness', 'Contrast']) $('dither' + key + 'Value').value = (Number(controls[key].value) > 0 ? '+' : '') + controls[key].value;
  $('ditherSizeValue').value = controls.Size.value + ' px';
  $('ditherThresholdValue').value = Math.round(Number(controls.Threshold.value) / 255 * 100) + '%';
  $('ditherInkValue').value = controls.Ink.value;
  $('ditherPaperValue').value = controls.Paper.value;
  $('ditherAlgorithmNote').textContent = descriptions[controls.Algorithm.value];
  document.querySelectorAll('[data-palette]').forEach((button) => {
    const [ink, paper] = palettes[button.dataset.palette];
    button.setAttribute('aria-pressed', String(ink === controls.Ink.value && paper === controls.Paper.value));
  });
}
function requestRender() {
  refreshControls();
  if (!source || workerFailed) return;
  version++;
  renderFailed = false;
  setReadyState();
  clearTimeout(renderTimer);
  renderTimer = setTimeout(sendRender, 60);
}
function sendRender() {
  if (!source || workerBusy || workerFailed || renderedVersion === version) return;
  workerBusy = true;
  setReadyState();
  const size = Number(controls.Size.value);
  scratch.width = Math.max(1, Math.round(outputWidth / size));
  scratch.height = Math.max(1, Math.round(outputHeight / size));
  scratchContext.imageSmoothingEnabled = true;
  scratchContext.drawImage(source, 0, 0, scratch.width, scratch.height);
  const image = scratchContext.getImageData(0, 0, scratch.width, scratch.height);
  const id = version;
  worker.postMessage({ id, image: { data: image.data, width: image.width, height: image.height }, options: readOptions() }, [image.data.buffer]);
  clearTimeout(busyTimer);
  busyTimer = setTimeout(() => {
    if (workerBusy) { $('ditherLoading').textContent = 'Finding the right dots…'; $('ditherLoading').hidden = false; }
  }, 180);
}
worker.onmessage = ({ data }) => {
  workerBusy = false;
  clearTimeout(busyTimer);
  if (data.id !== version) { sendRender(); return; }
  $('ditherLoading').hidden = true;
  if (data.error) {
    showError('This image could not be dithered. Try another image or reset the controls.');
    renderFailed = true;
    setReadyState();
    return;
  }
  const { result } = data;
  scratch.width = result.width;
  scratch.height = result.height;
  scratchContext.putImageData(new ImageData(result.data, result.width, result.height), 0, 0);
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  context.imageSmoothingEnabled = false;
  context.drawImage(scratch, 0, 0, outputWidth, outputHeight);
  renderedVersion = data.id;
  drawPreview();
  $('ditherDimensions').textContent = outputWidth + ' × ' + outputHeight + ' px';
  showError('');
  setReadyState();
};
worker.onerror = () => {
  workerBusy = false; workerFailed = true; clearTimeout(busyTimer);
  $('ditherLoading').hidden = true;
  showError('The dither engine could not start. Reload this page to try again.');
  setReadyState();
};
function setComparison(next) {
  compare = next;
  $('ditherOriginal').hidden = !compare;
  $('ditherOriginalLabel').hidden = !compare;
  $('ditherCompare').setAttribute('aria-pressed', String(compare));
  $('ditherCompareText').textContent = compare ? 'Show dither' : 'Show original';
}
async function loadImage(file = null) {
  const token = ++sourceVersion;
  loadPending = true;
  showError('');
  setReadyState();
  const nextUrl = file ? URL.createObjectURL(file) : new URL('./assets/anthurium.png', import.meta.url).href;
  const image = new Image();
  try {
    if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 25 * 1024 * 1024)) throw new Error('Choose a JPG, PNG, or WebP image smaller than 25 MB.');
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('That image could not be opened. Try another JPG, PNG, or WebP.')); image.src = nextUrl; });
    if (token !== sourceVersion) { if (file) URL.revokeObjectURL(nextUrl); return; }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Choose an image with fewer than 40 million pixels.');
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    outputWidth = Math.max(1, Math.round(image.naturalWidth * scale));
    outputHeight = Math.max(1, Math.round(image.naturalHeight * scale));
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = file ? nextUrl : null;
    source = image;
    sourceName = file ? file.name.replace(/\.[^.]+$/, '') : 'anthurium';
    $('ditherFileName').textContent = file ? file.name : 'Anthurium study';
    $('ditherFileType').textContent = file ? 'YOUR IMAGE' : 'SAMPLE';
    $('ditherOriginal').src = nextUrl;
    $('ditherStage').style.aspectRatio = outputWidth + ' / ' + outputHeight;
    $('ditherStage').style.setProperty('--dither-ratio', String(outputWidth / outputHeight));
    loadPending = false;
    setComparison(false);
    requestRender();
    announce(file ? 'Image opened. Try a style or make it your own.' : 'Sample ready. Try a style, or bring your own image.');
  } catch (error) {
    if (file) URL.revokeObjectURL(nextUrl);
    if (token !== sourceVersion) return;
    loadPending = false;
    $('ditherLoading').hidden = true;
    showError(error.message);
    setReadyState();
  }
}
$('ditherUpload').addEventListener('click', () => $('ditherInput').click());
$('ditherInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) loadImage(file);
  event.target.value = '';
});
$('ditherSample').addEventListener('click', () => loadImage());
$('ditherCompare').addEventListener('click', () => setComparison(!compare));
ids.forEach((key) => controls[key].addEventListener(key === 'Algorithm' || key === 'Invert' ? 'change' : 'input', requestRender));
document.querySelectorAll('[data-palette]').forEach((button) => button.addEventListener('click', () => {
  [controls.Ink.value, controls.Paper.value] = palettes[button.dataset.palette];
  requestRender();
}));
$('ditherSwap').addEventListener('click', () => { [controls.Ink.value, controls.Paper.value] = [controls.Paper.value, controls.Ink.value]; requestRender(); });
$('ditherReset').addEventListener('click', () => {
  ids.forEach((key) => { if (key === 'Invert') controls[key].checked = defaults[key]; else controls[key].value = defaults[key]; });
  setComparison(false);
  requestRender();
  announce('Controls reset. Your image is kept.');
});
const zone = $('ditherDropZone');
zone.addEventListener('dragenter', (event) => { event.preventDefault(); dragDepth++; $('ditherDropHint').hidden = false; });
zone.addEventListener('dragover', (event) => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; });
zone.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('ditherDropHint').hidden = true; });
zone.addEventListener('drop', (event) => {
  event.preventDefault(); dragDepth = 0; $('ditherDropHint').hidden = true;
  if (event.dataTransfer.files[0]) loadImage(event.dataTransfer.files[0]);
  else showError('Drop an image file, or use Upload image to choose one.');
});
$('ditherExport').addEventListener('click', () => {
  if ($('ditherExport').disabled) return;
  exporting = true;
  $('ditherExport').setAttribute('aria-busy', 'true');
  setReadyState();
  const exportName = (sourceName.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || 'fluid') + '-dither.png';
  canvas.toBlob((blob) => {
    exporting = false;
    $('ditherExport').removeAttribute('aria-busy');
    setReadyState();
    if (!blob) { showError('The PNG could not be created. Try a smaller image.'); return; }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = exportName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Your dither PNG is ready. Check your downloads.');
  }, 'image/png');
});
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) { previewObserver?.disconnect(); worker.terminate(); if (sourceUrl) URL.revokeObjectURL(sourceUrl); }
});
refreshControls();
loadImage();
