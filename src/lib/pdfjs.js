// pdf.js wrapper — the on-device PDF rasterizer used by the PDF app for real
// page viewing and thumbnails (the office/lopdf core only reads/edits structure,
// it can't render). Loaded lazily so the ~1 MB pdf.js bundle + worker aren't
// pulled until the user actually opens a PDF.
//
// All rendering runs in pdf.js's own web worker, so the main thread stays
// responsive even on large (1000+ page) documents.

let pdfjs = null;

async function lib() {
  if (pdfjs) return pdfjs;
  const mod = await import('pdfjs-dist');
  // Bundled worker (no CDN / network) — Vite turns this into a hashed URL.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  mod.GlobalWorkerOptions.workerSrc = workerUrl;
  pdfjs = mod;
  return mod;
}

// Open a PDF from bytes. Returns a pdf.js document proxy (has `.numPages`).
// Copy the bytes: pdf.js transfers/detaches the buffer to its worker, which
// would otherwise corrupt a Uint8Array the caller still holds.
export async function openPdf(bytes) {
  const pdfjsLib = await lib();
  const data = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
  const task = pdfjsLib.getDocument({ data });
  return task.promise;
}

// Render page `n` (1-based) of an open doc to a canvas at `scale`, applying an
// optional extra rotation (degrees, added to the page's own rotation). Returns
// the canvas.
export async function renderPageToCanvas(doc, n, scale = 1.5, rotateDeg = 0) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale, rotation: (page.rotate + rotateDeg) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

// Render a page to a Blob of the given image mime + quality.
export async function renderPageToBlob(doc, n, { scale = 1.5, mime = 'image/png', quality = 0.92, rotateDeg = 0 } = {}) {
  const canvas = await renderPageToCanvas(doc, n, scale, rotateDeg);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
}

// Render a small thumbnail (data URL) for a page — used in the Organize grid.
export async function renderThumb(doc, n, maxWidth = 200) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const scale = maxWidth / base.width;
  const canvas = await renderPageToCanvas(doc, n, scale, 0);
  return canvas.toDataURL('image/png');
}
