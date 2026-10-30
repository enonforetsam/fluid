/** Local-only, bounded image decoding. SVG is never inserted into the DOM. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export function fileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The file could not be read. Try another image.'));
    reader.onabort = () => reject(new Error('Image reading was cancelled.'));
    reader.readAsText(file);
  });
}
function fileURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.onabort = () => reject(new Error('Image reading was cancelled.'));
    reader.readAsDataURL(file);
  });
}
export function safeSVG(text) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('SVG documents with entities are not supported. Export a simple SVG or PNG.');
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (doc.querySelector('parsererror') || svg.localName !== 'svg') throw new Error('This SVG is not valid. Try a PNG.');
  const allowed = new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','linearGradient','radialGradient','stop','clipPath','mask','title','desc']);
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    if (!allowed.has(node.localName)) throw new Error('Use a simple SVG with paths, shapes and gradients, or a PNG. Scripts, images and filters are not supported.');
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase(), value = attr.value.trim();
      if ((name === 'xmlns' && value === 'http://www.w3.org/2000/svg') || (name === 'xmlns:xlink' && value === 'http://www.w3.org/1999/xlink')) continue;
      if (name.startsWith('on') || name === 'xml:base' || name === 'src' || name === 'style' || /(?:javascript:|data:|https?:|file:|@import|expression\s*\()/i.test(value)) throw new Error('This SVG contains unsupported styles or external content. Export paths or a PNG.');
      if ((name === 'href' || name === 'xlink:href') && !/^#[\w.-]+$/.test(value)) throw new Error('External SVG references are not supported.');
      for (const match of value.matchAll(/url\s*\(([^)]*)\)/gi)) if (!/^['"]?#[\w.-]+['"]?$/.test(match[1].trim())) throw new Error('External SVG resources are not supported.');
    }
  }
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const rawWidth=svg.getAttribute('width')||'',rawHeight=svg.getAttribute('height')||'';
  let width = /^\d+(?:\.\d+)?(?:px)?$/.test(rawWidth) ? parseFloat(rawWidth) : (vb.length === 4 ? vb[2] : 512);
  let height = /^\d+(?:\.\d+)?(?:px)?$/.test(rawHeight) ? parseFloat(rawHeight) : (vb.length === 4 ? vb[3] : 512);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width * height > 40000000 || width > 40000 || height > 40000) throw new Error('Use an image under 40 megapixels with valid dimensions.');
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
  return new XMLSerializer().serializeToString(svg);
}
export function decodeImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { image.onload = null; image.onerror = null; resolve(image); };
    image.onerror = () => { image.onload = null; image.onerror = null; reject(new Error('This image could not be decoded. Try a PNG, JPEG, WebP or simple SVG.')); };
    image.src = src;
  });
}
export async function readImageFile(file) {
  if (!file) return null;
  if (file.size > MAX_FILE_BYTES) throw new Error('Choose an image under 25 MB.');
  if (!/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(file.name) && !/^image\/(png|jpeg|webp|gif|avif|svg\+xml)$/.test(file.type)) throw new Error('Choose a PNG, JPEG, WebP, GIF, AVIF or SVG image.');
  const svg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  const src = svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(safeSVG(await fileText(file))) : await fileURL(file);
  const image = await decodeImage(src);
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Choose an image under 40 megapixels.');
  const ratio = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataURL = canvas.toDataURL('image/png');
  return { src: dataURL, image: await decodeImage(dataURL), name: file.name, width: canvas.width, height: canvas.height };
}
