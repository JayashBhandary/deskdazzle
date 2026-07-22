// Helpers shared by the PDF app's tabs: light-markup → Word model, raster image
// → JPEG bytes (for images→PDF), and "any supported file → PDF bytes" used by
// the Convert-to-PDF and merge-mixed flows.

import { office, readFileBytes, readFileText } from '@/lib/office';

// Light markup (#/##/### headings, -/* bullets, blank-line paragraphs) → the
// office Word model, which the core renders to PDF.
export function composeToWordDoc(title, text) {
  const blocks = [];
  if (title && title.trim()) blocks.push({ type: 'heading', level: 1, text: title.trim() });
  let list = null;
  const flush = () => { if (list) { blocks.push({ type: 'list', ordered: false, items: list }); list = null; } };
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const b = line.match(/^[-*]\s+(.*)$/);
    if (h) { flush(); blocks.push({ type: 'heading', level: Math.min(3, h[1].length) + 1, text: h[2] }); }
    else if (b) { (list ||= []).push(b[1]); }
    else if (line.trim()) { flush(); blocks.push({ type: 'paragraph', runs: [{ text: line }] }); }
    else { flush(); }
  }
  flush();
  return { blocks };
}

// Decode any browser-supported image File into baseline JPEG bytes + pixel
// dimensions (downscaled so a huge photo doesn't bloat the PDF). Rust embeds the
// JPEG directly (DCTDecode), so this canvas transcode is what lets us accept
// PNG/WebP/GIF/etc. uniformly.
export async function imageFileToJpeg(file, maxDim = 2200, quality = 0.9) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('Could not decode image'));
      im.src = url;
    });
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // flatten transparency (JPEG has no alpha)
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const extOf = (name) => (name.lastIndexOf('.') >= 0 ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '');

// True if the app can turn this file into a PDF.
export function canConvertToPdf(name) {
  return /^(pdf|png|jpe?g|webp|gif|bmp|docx?|xlsx?|xlsb|ods|csv|pptx?|txt|md|markdown)$/.test(extOf(name));
}

// Convert one File to PDF bytes. Reuses the office core for docs and the new
// images_to_pdf for rasters; PDFs pass through unchanged.
export async function fileToPdf(file) {
  const ext = extOf(file.name);
  if (ext === 'pdf') return readFileBytes(file);
  if (/^(png|jpe?g|webp|gif|bmp)$/.test(ext)) {
    const img = await imageFileToJpeg(file);
    return office.imagesToPdf([img]);
  }
  if (/^docx?$/.test(ext)) {
    const model = await office.wordImport(await readFileBytes(file));
    return office.wordPdf(model);
  }
  if (/^(xlsx?|xlsb|ods)$/.test(ext)) {
    const wb = await office.excelImport(await readFileBytes(file));
    return office.excelPdf(wb);
  }
  if (ext === 'csv') {
    const rows = await office.csvImport(await readFileText(file));
    return office.excelPdf({ sheets: [{ name: 'Sheet1', rows }] });
  }
  if (/^pptx?$/.test(ext)) {
    const pres = await office.pptImport(await readFileBytes(file));
    return office.pptPdf(pres);
  }
  if (/^(txt|md|markdown)$/.test(ext)) {
    const text = await readFileText(file);
    return office.wordPdf(composeToWordDoc(file.name.replace(/\.[^.]+$/, ''), text));
  }
  throw new Error(`Can't convert .${ext} to PDF`);
}
