//! Operations on *existing* PDF files via `lopdf`: merge, page count, and a
//! single "organize" primitive that reorders / deletes / rotates / extracts
//! pages (a subset in a chosen order, each optionally rotated). Composing a new
//! PDF from a document model lives in `pdf.rs`; this module only edits PDFs the
//! user already has.

use std::collections::BTreeMap;
use std::io::Cursor;

use lopdf::{Document, Object, ObjectId};
use serde::Deserialize;

/// Number of pages in a PDF.
pub fn page_count(bytes: &[u8]) -> Result<u32, String> {
    let doc = Document::load_mem(bytes).map_err(|e| e.to_string())?;
    Ok(doc.get_pages().len() as u32)
}

/// Merge PDF `a` followed by PDF `b` into one document. JS folds this over a
/// list, so the wasm boundary only ever passes two byte arrays.
pub fn merge(a: &[u8], b: &[u8]) -> Result<Vec<u8>, String> {
    let da = Document::load_mem(a).map_err(|e| e.to_string())?;
    let db = Document::load_mem(b).map_err(|e| e.to_string())?;
    merge_documents(vec![da, db])
}

#[derive(Deserialize)]
struct PageOp {
    /// 0-based index into the source document's page order.
    page: u32,
    /// Clockwise rotation in degrees (0/90/180/270); 0 = unchanged.
    #[serde(default)]
    rotate: i64,
}

/// Build a new PDF containing the given source pages, in the given order, each
/// optionally rotated. Omitting a page deletes it; repeating one duplicates it;
/// a subset extracts/splits.
pub fn organize(bytes: &[u8], ops_json: &str) -> Result<Vec<u8>, String> {
    let ops: Vec<PageOp> = serde_json::from_str(ops_json).map_err(|e| e.to_string())?;
    let mut doc = Document::load_mem(bytes).map_err(|e| e.to_string())?;

    let pages = doc.get_pages(); // 1-based page number -> object id
    let ordered: Vec<u32> = pages.keys().copied().collect();

    // Resolve the Pages tree root from the catalog.
    let root_id = doc
        .trailer
        .get(b"Root")
        .map_err(|e| e.to_string())?
        .as_reference()
        .map_err(|e| e.to_string())?;
    let pages_root = doc
        .get_object(root_id)
        .and_then(|o| o.as_dict())
        .map_err(|e| e.to_string())?
        .get(b"Pages")
        .map_err(|e| e.to_string())?
        .as_reference()
        .map_err(|e| e.to_string())?;

    let mut kids: Vec<ObjectId> = Vec::with_capacity(ops.len());
    for op in &ops {
        let page_no = ordered
            .get(op.page as usize)
            .copied()
            .ok_or_else(|| format!("page {} out of range", op.page))?;
        let oid = *pages.get(&page_no).unwrap();
        if op.rotate % 360 != 0 {
            let deg = ((op.rotate % 360) + 360) % 360;
            if let Ok(dict) = doc.get_object_mut(oid).and_then(|o| o.as_dict_mut()) {
                dict.set("Rotate", Object::Integer(deg));
            }
        }
        kids.push(oid);
    }

    if kids.is_empty() {
        return Err("no pages selected".into());
    }

    // Re-parent kept pages and rewrite the page tree.
    for &k in &kids {
        if let Ok(dict) = doc.get_object_mut(k).and_then(|o| o.as_dict_mut()) {
            dict.set("Parent", Object::Reference(pages_root));
        }
    }
    if let Ok(dict) = doc.get_object_mut(pages_root).and_then(|o| o.as_dict_mut()) {
        let count = kids.len() as i64;
        dict.set(
            "Kids",
            kids.iter().map(|id| Object::Reference(*id)).collect::<Vec<_>>(),
        );
        dict.set("Count", Object::Integer(count));
    }

    doc.renumber_objects();
    let mut out = Vec::new();
    doc.save_to(&mut Cursor::new(&mut out)).map_err(|e| e.to_string())?;
    Ok(out)
}

// ---- merge (adapted from the canonical lopdf merge recipe) ----

fn merge_documents(documents: Vec<Document>) -> Result<Vec<u8>, String> {
    let mut max_id = 1;
    let mut pagenum = 1;
    let mut documents_pages: BTreeMap<ObjectId, Object> = BTreeMap::new();
    let mut documents_objects: BTreeMap<ObjectId, Object> = BTreeMap::new();
    let mut document = Document::with_version("1.5");

    for mut doc in documents {
        let mut first = false;
        doc.renumber_objects_with(max_id);
        max_id = doc.max_id + 1;

        documents_pages.extend(
            doc.get_pages()
                .into_values()
                .map(|object_id| {
                    if !first {
                        first = true;
                    }
                    pagenum += 1;
                    (object_id, doc.get_object(object_id).unwrap().to_owned())
                })
                .collect::<BTreeMap<ObjectId, Object>>(),
        );
        documents_objects.extend(doc.objects);
    }
    let _ = pagenum;

    let mut catalog_object: Option<(ObjectId, Object)> = None;
    let mut pages_object: Option<(ObjectId, Object)> = None;

    for (object_id, object) in documents_objects.iter() {
        match object.type_name().unwrap_or_default() {
            "Catalog" => {
                catalog_object = Some((
                    catalog_object.as_ref().map(|(id, _)| *id).unwrap_or(*object_id),
                    object.clone(),
                ));
            }
            "Pages" => {
                if let Ok(dictionary) = object.as_dict() {
                    let mut dictionary = dictionary.clone();
                    if let Some((_, prev)) = pages_object.as_ref() {
                        if let Ok(prev_dict) = prev.as_dict() {
                            dictionary.extend(prev_dict);
                        }
                    }
                    pages_object = Some((
                        pages_object.as_ref().map(|(id, _)| *id).unwrap_or(*object_id),
                        Object::Dictionary(dictionary),
                    ));
                }
            }
            "Page" | "Outlines" | "Outline" => {}
            _ => {
                document.objects.insert(*object_id, object.clone());
            }
        }
    }

    let pages_object = pages_object.ok_or("no Pages root found in inputs")?;
    let catalog_object = catalog_object.ok_or("no Catalog found in inputs")?;

    // Point every page at the merged Pages node and collect it.
    for (object_id, object) in documents_pages.iter() {
        if let Ok(dictionary) = object.as_dict() {
            let mut dictionary = dictionary.clone();
            dictionary.set("Parent", Object::Reference(pages_object.0));
            document
                .objects
                .insert(*object_id, Object::Dictionary(dictionary));
        }
    }

    // Rebuild the Pages node with all kids + count.
    if let Ok(dictionary) = pages_object.1.as_dict() {
        let mut dictionary = dictionary.clone();
        dictionary.set("Count", documents_pages.len() as u32);
        dictionary.set(
            "Kids",
            documents_pages
                .keys()
                .map(|id| Object::Reference(*id))
                .collect::<Vec<_>>(),
        );
        document
            .objects
            .insert(pages_object.0, Object::Dictionary(dictionary));
    }

    // Rebuild the Catalog to point at the merged Pages node.
    if let Ok(dictionary) = catalog_object.1.as_dict() {
        let mut dictionary = dictionary.clone();
        dictionary.set("Pages", Object::Reference(pages_object.0));
        dictionary.remove(b"Outlines");
        document
            .objects
            .insert(catalog_object.0, Object::Dictionary(dictionary));
    }

    document.trailer.set("Root", Object::Reference(catalog_object.0));
    document.max_id = document.objects.len() as u32;
    document.renumber_objects();
    document.compress();

    let mut out = Vec::new();
    document
        .save_to(&mut Cursor::new(&mut out))
        .map_err(|e| e.to_string())?;
    Ok(out)
}
