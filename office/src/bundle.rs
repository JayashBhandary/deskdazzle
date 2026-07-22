//! Bundling helpers for the PDF app:
//!   - `zip_files`  : pack named byte blobs into a .zip (Stored — inputs are
//!                    already-compressed images, so no re-deflate).
//!   - `images_to_pdf`: lay a set of JPEG images out as PDF pages (one per
//!                    page, fit to A4 preserving aspect ratio).
//!
//! Both take a JSON manifest plus one concatenated byte buffer, and split the
//! buffer by each entry's `len` — this keeps the wasm-bindgen surface to a
//! string + a single `Uint8Array` (no array-of-arrays marshalling).

use std::io::{Cursor, Read, Write};

use pdf_writer::{Content, Filter, Finish, Name, Pdf, Rect, Ref};
use serde::{Deserialize, Serialize};
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

#[derive(Deserialize)]
pub struct ZipEntry {
    pub name: String,
    pub len: usize,
}

/// Pack `data` (the entries' bytes concatenated in order) into a .zip. Entries
/// are stored uncompressed — the app zips already-compressed page images, where
/// deflate would only burn CPU for ~no size win.
pub fn zip_files(manifest_json: &str, data: &[u8]) -> Result<Vec<u8>, String> {
    let entries: Vec<ZipEntry> = serde_json::from_str(manifest_json).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

    let mut offset = 0usize;
    let mut seen: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    for e in &entries {
        let end = offset + e.len;
        if end > data.len() {
            return Err("manifest lengths exceed data buffer".into());
        }
        // de-dupe repeated names: foo.png, foo (1).png, …
        let name = {
            let n = seen.entry(e.name.clone()).or_insert(0);
            let out = if *n == 0 {
                e.name.clone()
            } else if let Some(dot) = e.name.rfind('.') {
                format!("{} ({}){}", &e.name[..dot], n, &e.name[dot..])
            } else {
                format!("{} ({})", e.name, n)
            };
            *n += 1;
            out
        };
        zip.start_file(name, opts).map_err(|e| e.to_string())?;
        zip.write_all(&data[offset..end]).map_err(|e| e.to_string())?;
        offset = end;
    }
    let cursor = zip.finish().map_err(|e| e.to_string())?;
    Ok(cursor.into_inner())
}

#[derive(Serialize)]
struct OutEntry {
    name: String,
    len: usize,
}

/// Extract a .zip into a self-describing blob: a little-endian u32 manifest
/// length, then the manifest JSON (`[{"name","len"}]`), then every file's bytes
/// concatenated in the same order. The JS side slices this back into files with
/// no base64 bloat. Directory entries are skipped (their files carry the path in
/// `name`).
pub fn unzip(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let mut zip = ZipArchive::new(Cursor::new(bytes.to_vec())).map_err(|e| e.to_string())?;
    let mut entries: Vec<OutEntry> = Vec::new();
    let mut data: Vec<u8> = Vec::new();
    for i in 0..zip.len() {
        let mut f = zip.by_index(i).map_err(|e| e.to_string())?;
        if f.is_dir() {
            continue;
        }
        let name = f
            .enclosed_name()
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|| f.name().to_string());
        let mut buf = Vec::new();
        f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        entries.push(OutEntry { name, len: buf.len() });
        data.extend_from_slice(&buf);
    }
    let manifest = serde_json::to_vec(&entries).map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(4 + manifest.len() + data.len());
    out.extend_from_slice(&(manifest.len() as u32).to_le_bytes());
    out.extend_from_slice(&manifest);
    out.extend_from_slice(&data);
    Ok(out)
}

#[derive(Deserialize)]
pub struct ImgEntry {
    /// Pixel width of the JPEG.
    pub w: i32,
    /// Pixel height of the JPEG.
    pub h: i32,
    /// Byte length of this JPEG in the concatenated buffer.
    pub len: usize,
}

// A4 in points.
const A4_W: f32 = 595.0;
const A4_H: f32 = 842.0;
const MARGIN: f32 = 24.0;

/// Build a PDF where each JPEG in `data` (concatenated, split by manifest `len`)
/// becomes one A4 page with the image centred and scaled to fit within the
/// margins, preserving aspect ratio. Inputs must be baseline RGB JPEG (the JS
/// side transcodes any image format to JPEG via canvas before calling this).
pub fn images_to_pdf(manifest_json: &str, data: &[u8]) -> Result<Vec<u8>, String> {
    let entries: Vec<ImgEntry> = serde_json::from_str(manifest_json).map_err(|e| e.to_string())?;
    if entries.is_empty() {
        return Err("no images".into());
    }

    let mut pdf = Pdf::new();
    let catalog_id = Ref::new(1);
    let page_tree_id = Ref::new(2);
    pdf.catalog(catalog_id).pages(page_tree_id);

    // Ids: page/image/content per entry, starting after the tree.
    let mut next = 3i32;
    let mut page_ids = Vec::with_capacity(entries.len());
    let mut triples = Vec::with_capacity(entries.len());
    for _ in &entries {
        let page = Ref::new(next);
        let image = Ref::new(next + 1);
        let content = Ref::new(next + 2);
        page_ids.push(page);
        triples.push((page, image, content));
        next += 3;
    }
    pdf.pages(page_tree_id)
        .kids(page_ids.iter().copied())
        .count(entries.len() as i32);

    let img_name = Name(b"Im0");
    let mut offset = 0usize;
    for (e, (page_id, image_id, content_id)) in entries.iter().zip(triples.iter()) {
        let end = offset + e.len;
        if end > data.len() {
            return Err("manifest lengths exceed data buffer".into());
        }
        let jpeg = &data[offset..end];
        offset = end;
        if e.w <= 0 || e.h <= 0 {
            return Err("bad image dimensions".into());
        }

        // Page.
        {
            let mut page = pdf.page(*page_id);
            page.media_box(Rect::new(0.0, 0.0, A4_W, A4_H));
            page.parent(page_tree_id);
            page.contents(*content_id);
            page.resources().x_objects().pair(img_name, *image_id);
            page.finish();
        }

        // Image XObject (JPEG → DCTDecode, RGB).
        {
            let mut image = pdf.image_xobject(*image_id, jpeg);
            image.filter(Filter::DctDecode);
            image.width(e.w);
            image.height(e.h);
            image.color_space().device_rgb();
            image.bits_per_component(8);
            image.finish();
        }

        // Fit within margins, preserve aspect ratio, centre.
        let avail_w = A4_W - MARGIN * 2.0;
        let avail_h = A4_H - MARGIN * 2.0;
        let s = (avail_w / e.w as f32).min(avail_h / e.h as f32);
        let draw_w = e.w as f32 * s;
        let draw_h = e.h as f32 * s;
        let x = (A4_W - draw_w) / 2.0;
        let y = (A4_H - draw_h) / 2.0;

        let mut content = Content::new();
        content.save_state();
        content.transform([draw_w, 0.0, 0.0, draw_h, x, y]);
        content.x_object(img_name);
        content.restore_state();
        pdf.stream(*content_id, &content.finish());
    }

    Ok(pdf.finish())
}
