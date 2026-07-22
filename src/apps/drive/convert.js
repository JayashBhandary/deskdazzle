// On-device file conversions for the Drive explorer. Every conversion runs via
// the office Rust/wasm core, the pocketknife core, canvas, or WebAudio — nothing
// leaves the device. Each `runConvert` returns { name, bytes, mime } which the
// Drive writes back as a new file node.

import { office } from '@/lib/office';
import { composeToWordDoc } from '../pdf/pdfShared';

export const extOf = (name) => (name.lastIndexOf('.') >= 0 ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '');
const base = (name) => name.replace(/\.[^.]+$/, '');

const IMG = /^(png|jpe?g|webp|gif|bmp)$/;
const VIDEO = /^(mp4|webm|mov|mkv|avi|m4v|ogv)$/;
const MIME = {
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  wav: 'audio/wav',
  zip: 'application/zip',
};

// Which conversions are offered for a given filename → [{ key, label, ext }].
export function convertTargets(name) {
  const e = extOf(name);
  const out = [];
  if (IMG.test(e)) {
    for (const [k, label] of [['png', 'PNG'], ['jpg', 'JPEG'], ['webp', 'WebP']]) {
      if (k !== e && !(k === 'jpg' && e === 'jpeg')) out.push({ key: k, label: `Image → ${label}`, ext: k });
    }
    out.push({ key: 'pdf', label: 'Image → PDF', ext: 'pdf' });
  } else if (/^docx?$/.test(e)) {
    out.push({ key: 'pdf', label: 'Word → PDF', ext: 'pdf' });
  } else if (/^(xlsx?|xlsb|ods)$/.test(e)) {
    out.push({ key: 'csv', label: 'Spreadsheet → CSV', ext: 'csv' });
    out.push({ key: 'pdf', label: 'Spreadsheet → PDF', ext: 'pdf' });
  } else if (e === 'csv') {
    out.push({ key: 'xlsx', label: 'CSV → Excel (.xlsx)', ext: 'xlsx' });
    out.push({ key: 'pdf', label: 'CSV → PDF', ext: 'pdf' });
  } else if (/^(txt|md|markdown)$/.test(e)) {
    out.push({ key: 'docx', label: 'Text → Word (.docx)', ext: 'docx' });
    out.push({ key: 'pdf', label: 'Text → PDF', ext: 'pdf' });
  } else if (/^pptx?$/.test(e)) {
    out.push({ key: 'pdf', label: 'Slides → PDF', ext: 'pdf' });
  } else if (VIDEO.test(e)) {
    out.push({ key: 'wav', label: 'Video → Audio (.wav)', ext: 'wav' });
  }
  return out;
}

// Decode arbitrary image bytes → baseline JPEG bytes + pixel dims (for →PDF).
async function imageBytesToJpeg(bytes, mime, maxDim = 2200, quality = 0.9) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime || 'image/png' }));
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Transcode image bytes to another raster format via canvas.
async function transcodeImage(bytes, srcMime, targetMime, quality = 0.92) {
  const url = URL.createObjectURL(new Blob([bytes], { type: srcMime || 'image/png' }));
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (targetMime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise((r) => canvas.toBlob(r, targetMime, quality));
    if (!blob) throw new Error('This browser can’t encode that image format');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Could not decode image'));
    im.src = url;
  });
}

// Any supported file (as bytes) → PDF bytes.
async function anyToPdf(name, bytes, mime) {
  const e = extOf(name);
  if (e === 'pdf') return bytes;
  if (IMG.test(e)) { const img = await imageBytesToJpeg(bytes, mime); return office.imagesToPdf([img]); }
  if (/^docx?$/.test(e)) return office.wordPdf(await office.wordImport(bytes));
  if (/^(xlsx?|xlsb|ods)$/.test(e)) return office.excelPdf(await office.excelImport(bytes));
  if (e === 'csv') return office.excelPdf({ sheets: [{ name: 'Sheet1', rows: await office.csvImport(text(bytes)) }] });
  if (/^pptx?$/.test(e)) return office.pptPdf(await office.pptImport(bytes));
  if (/^(txt|md|markdown)$/.test(e)) return office.wordPdf(composeToWordDoc(base(name), text(bytes)));
  throw new Error(`Can't convert .${e} to PDF`);
}

const text = (bytes) => new TextDecoder().decode(bytes);

// ---- WebAudio → WAV (video/audio → uncompressed WAV) --------------------
function encodeWav(audioBuffer) {
  const numCh = audioBuffer.numberOfChannels;
  const rate = audioBuffer.sampleRate;
  const len = audioBuffer.length;
  const blockAlign = numCh * 2;
  const dataSize = len * blockAlign;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); str(8, 'WAVE');
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numCh, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * blockAlign, true); view.setUint16(32, blockAlign, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, dataSize, true);
  const chans = [];
  for (let c = 0; c < numCh; c++) chans.push(audioBuffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Uint8Array(buf);
}

async function videoToWav(bytes) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('WebAudio unavailable');
  const ctx = new AC();
  try {
    const audioBuf = await ctx.decodeAudioData(bytes.slice().buffer);
    return encodeWav(audioBuf);
  } catch {
    throw new Error('Could not decode audio from this video');
  } finally {
    ctx.close?.();
  }
}

// Run one conversion. `file` = { name, bytes, mime }. Returns { name, bytes, mime }.
export async function runConvert(file, key) {
  const { name, bytes, mime } = file;
  if (key === 'pdf') return { name: `${base(name)}.pdf`, bytes: await anyToPdf(name, bytes, mime), mime: MIME.pdf };
  if (key === 'png' || key === 'jpg' || key === 'webp') {
    const targetMime = key === 'jpg' ? 'image/jpeg' : `image/${key}`;
    return { name: `${base(name)}.${key}`, bytes: await transcodeImage(bytes, mime, targetMime), mime: targetMime };
  }
  if (key === 'csv') {
    const wb = await office.excelImport(bytes);
    const rows = wb.sheets?.[0]?.rows || [];
    const csv = await office.csvExport(rows);
    return { name: `${base(name)}.csv`, bytes: new TextEncoder().encode(csv), mime: MIME.csv };
  }
  if (key === 'xlsx') {
    const rows = await office.csvImport(text(bytes));
    return { name: `${base(name)}.xlsx`, bytes: await office.excelExport({ sheets: [{ name: 'Sheet1', rows }] }), mime: MIME.xlsx };
  }
  if (key === 'docx') {
    return { name: `${base(name)}.docx`, bytes: await office.wordExport(composeToWordDoc(base(name), text(bytes))), mime: MIME.docx };
  }
  if (key === 'wav') {
    return { name: `${base(name)}.wav`, bytes: await videoToWav(bytes), mime: MIME.wav };
  }
  throw new Error(`Unknown conversion: ${key}`);
}
