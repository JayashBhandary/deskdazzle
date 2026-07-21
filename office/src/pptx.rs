//! PowerPoint (.pptx) <-> `Presentation` model. .pptx has no usable Rust crate,
//! so this hand-rolls the OOXML package: a Zip of XML parts (content types,
//! relationships, one slide master / layout / theme / notes master, and a slide
//! + optional notes slide per model slide). "Practical, clean" fidelity: titles,
//! multi-level bullets, images, tables and speaker notes — the structures every
//! viewer agrees on. Animations/transitions/charts are out of scope.

use std::io::{Cursor, Write};

use base64::{engine::general_purpose::STANDARD, Engine};
use zip::{write::SimpleFileOptions, ZipWriter};

use crate::model::{Bullet, Presentation, Slide, SlideBlock};

// 16:9 widescreen slide, in EMU (914400 EMU = 1 inch).
const SLIDE_W: i64 = 12192000;
const SLIDE_H: i64 = 6858000;
const MARGIN_X: i64 = 685800;
const CONTENT_W: i64 = SLIDE_W - 2 * MARGIN_X;
const TITLE_Y: i64 = 381000;
const TITLE_H: i64 = 1143000;
const CONTENT_TOP: i64 = 1600200;
const CONTENT_H: i64 = SLIDE_H - CONTENT_TOP - 457200;

fn xml_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(c),
        }
    }
    out
}

fn ext_for_mime(mime: &str) -> &'static str {
    match mime {
        "image/png" => "png",
        "image/jpeg" | "image/jpg" => "jpg",
        "image/gif" => "gif",
        _ => "png",
    }
}

struct MediaFile {
    name: String, // e.g. "image1.png"
    bytes: Vec<u8>,
}

/// Serialize a `Presentation` model to .pptx bytes.
pub fn export(pres: &Presentation) -> Result<Vec<u8>, String> {
    let slides = if pres.slides.is_empty() {
        vec![Slide {
            layout: "title".into(),
            title: "Untitled".into(),
            ..Default::default()
        }]
    } else {
        pres.slides.clone()
    };
    let n = slides.len();

    let buf = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(buf);
    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let mut media_exts: Vec<&'static str> = Vec::new();
    let mut has_notes_flags: Vec<bool> = Vec::new();

    // First pass: build each slide's XML + collect its media, so we know which
    // notes slides and image extensions exist before writing content types.
    struct BuiltSlide {
        xml: String,
        media: Vec<MediaFile>,
        has_notes: bool,
        img_rid_start: usize,
    }
    let mut built: Vec<BuiltSlide> = Vec::with_capacity(n);
    let mut media_counter = 0usize;
    for (i, slide) in slides.iter().enumerate() {
        let has_notes = !slide.notes.trim().is_empty();
        let img_rid_start = if has_notes { 3 } else { 2 };
        let (xml, media) = build_slide(slide, i, img_rid_start, &mut media_counter)?;
        for m in &media {
            let ext = m.name.rsplit('.').next().unwrap_or("png");
            let ext: &'static str = match ext {
                "png" => "png",
                "jpg" => "jpg",
                "gif" => "gif",
                _ => "png",
            };
            if !media_exts.contains(&ext) {
                media_exts.push(ext);
            }
        }
        has_notes_flags.push(has_notes);
        built.push(BuiltSlide { xml, media, has_notes, img_rid_start });
    }

    let write = |zip: &mut ZipWriter<Cursor<Vec<u8>>>, path: &str, data: &[u8]| -> Result<(), String> {
        zip.start_file(path, opts).map_err(|e| e.to_string())?;
        zip.write_all(data).map_err(|e| e.to_string())?;
        Ok(())
    };

    write(&mut zip, "[Content_Types].xml", content_types(n, &has_notes_flags, &media_exts).as_bytes())?;
    write(&mut zip, "_rels/.rels", ROOT_RELS.as_bytes())?;
    write(&mut zip, "ppt/presentation.xml", presentation_xml(n).as_bytes())?;
    write(&mut zip, "ppt/_rels/presentation.xml.rels", presentation_rels(n).as_bytes())?;
    write(&mut zip, "ppt/presProps.xml", PRES_PROPS.as_bytes())?;
    write(&mut zip, "ppt/theme/theme1.xml", THEME.as_bytes())?;
    write(&mut zip, "ppt/slideMasters/slideMaster1.xml", SLIDE_MASTER.as_bytes())?;
    write(&mut zip, "ppt/slideMasters/_rels/slideMaster1.xml.rels", SLIDE_MASTER_RELS.as_bytes())?;
    write(&mut zip, "ppt/slideLayouts/slideLayout1.xml", SLIDE_LAYOUT.as_bytes())?;
    write(&mut zip, "ppt/slideLayouts/_rels/slideLayout1.xml.rels", SLIDE_LAYOUT_RELS.as_bytes())?;
    write(&mut zip, "ppt/notesMasters/notesMaster1.xml", NOTES_MASTER.as_bytes())?;
    write(&mut zip, "ppt/notesMasters/_rels/notesMaster1.xml.rels", NOTES_MASTER_RELS.as_bytes())?;

    for (i, b) in built.iter().enumerate() {
        let num = i + 1;
        write(&mut zip, &format!("ppt/slides/slide{num}.xml"), b.xml.as_bytes())?;
        write(
            &mut zip,
            &format!("ppt/slides/_rels/slide{num}.xml.rels"),
            slide_rels(num, b.has_notes, &b.media, b.img_rid_start).as_bytes(),
        )?;
        for m in &b.media {
            write(&mut zip, &format!("ppt/media/{}", m.name), &m.bytes)?;
        }
        if b.has_notes {
            write(&mut zip, &format!("ppt/notesSlides/notesSlide{num}.xml"), notes_slide_xml(&slides[i].notes).as_bytes())?;
            write(
                &mut zip,
                &format!("ppt/notesSlides/_rels/notesSlide{num}.xml.rels"),
                notes_slide_rels(num).as_bytes(),
            )?;
        }
    }

    let cursor = zip.finish().map_err(|e| e.to_string())?;
    Ok(cursor.into_inner())
}

// ---------- per-slide content ----------

fn build_slide(
    slide: &Slide,
    _idx: usize,
    img_rid_start: usize,
    media_counter: &mut usize,
) -> Result<(String, Vec<MediaFile>), String> {
    let mut shapes = String::new();
    let mut media: Vec<MediaFile> = Vec::new();
    let mut id = 2u32; // 1 is the group shape
    let mut next_id = || {
        let v = id;
        id += 1;
        v
    };
    let mut img_rid = img_rid_start;

    let layout = slide.layout.as_str();
    let centered = layout == "title" || layout == "section";

    // Title.
    if !slide.title.trim().is_empty() {
        if centered {
            let y = if slide.subtitle.trim().is_empty() { 2600000 } else { 2100000 };
            shapes.push_str(&sp_placeholder(
                next_id(),
                "Title",
                "ctrTitle",
                None,
                MARGIN_X,
                y,
                CONTENT_W,
                1200000,
                &title_txbody(&slide.title, 40, true, "ctr"),
            ));
            if !slide.subtitle.trim().is_empty() {
                shapes.push_str(&sp_placeholder(
                    next_id(),
                    "Subtitle",
                    "subTitle",
                    Some(1),
                    MARGIN_X,
                    3450000,
                    CONTENT_W,
                    900000,
                    &title_txbody(&slide.subtitle, 22, false, "ctr"),
                ));
            }
        } else if layout == "blank" {
            shapes.push_str(&sp_textbox(
                next_id(),
                MARGIN_X,
                TITLE_Y,
                CONTENT_W,
                TITLE_H,
                &title_txbody(&slide.title, 32, true, "l"),
            ));
        } else {
            shapes.push_str(&sp_placeholder(
                next_id(),
                "Title",
                "title",
                None,
                MARGIN_X,
                TITLE_Y,
                CONTENT_W,
                TITLE_H,
                &title_txbody(&slide.title, 32, true, "l"),
            ));
        }
    }

    // Content blocks — stacked vertically in the content region. Centered
    // layouts (title/section) ignore content blocks by design.
    if !centered && !slide.content.is_empty() {
        let n = slide.content.len() as i64;
        let gap: i64 = 91440;
        let slot_h = ((CONTENT_H - gap * (n - 1)).max(457200)) / n;
        let mut y = CONTENT_TOP;
        let mut used_body = false;
        for block in &slide.content {
            match block {
                SlideBlock::Bullets { items } => {
                    let tb = bullets_txbody(items);
                    if !used_body && layout != "blank" {
                        used_body = true;
                        shapes.push_str(&sp_placeholder(
                            next_id(), "Content", "body", Some(1),
                            MARGIN_X, y, CONTENT_W, slot_h, &tb,
                        ));
                    } else {
                        shapes.push_str(&sp_textbox(next_id(), MARGIN_X, y, CONTENT_W, slot_h, &tb));
                    }
                }
                SlideBlock::Image { data, mime } => {
                    let bytes = STANDARD
                        .decode(data.trim())
                        .map_err(|e| format!("bad image data: {e}"))?;
                    *media_counter += 1;
                    let name = format!("image{}.{}", media_counter, ext_for_mime(mime));
                    let rid = img_rid;
                    img_rid += 1;
                    shapes.push_str(&pic_shape(next_id(), rid, MARGIN_X, y, CONTENT_W, slot_h));
                    media.push(MediaFile { name, bytes });
                }
                SlideBlock::Table { rows } => {
                    shapes.push_str(&table_frame(next_id(), rows, MARGIN_X, y, CONTENT_W, slot_h));
                }
            }
            y += slot_h + gap;
        }
    }

    let xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>{shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>"#,
    );
    Ok((xml, media))
}

fn ph_tag(ph_type: &str, idx: Option<u32>) -> String {
    match idx {
        Some(i) => format!(r#"<p:ph type="{ph_type}" idx="{i}"/>"#),
        None => format!(r#"<p:ph type="{ph_type}"/>"#),
    }
}

#[allow(clippy::too_many_arguments)]
fn sp_placeholder(
    id: u32,
    name: &str,
    ph_type: &str,
    idx: Option<u32>,
    x: i64,
    y: i64,
    w: i64,
    h: i64,
    txbody: &str,
) -> String {
    format!(
        r#"<p:sp><p:nvSpPr><p:cNvPr id="{id}" name="{name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>{ph}</p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm></p:spPr>{txbody}</p:sp>"#,
        ph = ph_tag(ph_type, idx),
    )
}

fn sp_textbox(id: u32, x: i64, y: i64, w: i64, h: i64, txbody: &str) -> String {
    format!(
        r#"<p:sp><p:nvSpPr><p:cNvPr id="{id}" name="TextBox {id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>{txbody}</p:sp>"#,
    )
}

fn title_txbody(text: &str, sz_pt: i32, bold: bool, align: &str) -> String {
    let sz = sz_pt * 100;
    let b = if bold { r#" b="1""# } else { "" };
    format!(
        r#"<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="{align}"/><a:r><a:rPr lang="en-US" sz="{sz}"{b} dirty="0"/><a:t>{t}</a:t></a:r></a:p></p:txBody>"#,
        t = xml_escape(text),
    )
}

fn bullets_txbody(items: &[Bullet]) -> String {
    let mut paras = String::new();
    if items.is_empty() {
        paras.push_str("<a:p/>");
    }
    for b in items {
        let lvl = b.level.min(4);
        paras.push_str(&format!(
            r#"<a:p><a:pPr lvl="{lvl}"><a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="en-US" sz="1800" dirty="0"/><a:t>{t}</a:t></a:r></a:p>"#,
            t = xml_escape(&b.text),
        ));
    }
    format!(r#"<p:txBody><a:bodyPr><a:normAutofit/></a:bodyPr><a:lstStyle/>{paras}</p:txBody>"#)
}

fn pic_shape(id: u32, rid: usize, x: i64, y: i64, w: i64, h: i64) -> String {
    format!(
        r#"<p:pic><p:nvPicPr><p:cNvPr id="{id}" name="Picture {id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId{rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>"#,
    )
}

fn table_frame(id: u32, rows: &[Vec<String>], x: i64, y: i64, w: i64, h: i64) -> String {
    if rows.is_empty() {
        return String::new();
    }
    let ncols = rows.iter().map(|r| r.len()).max().unwrap_or(1).max(1);
    let colw = w / ncols as i64;
    let nrows = rows.len() as i64;
    let rowh = (h / nrows).max(370840);

    let mut grid = String::new();
    for _ in 0..ncols {
        grid.push_str(&format!(r#"<a:gridCol w="{colw}"/>"#));
    }

    let mut trs = String::new();
    for (r, row) in rows.iter().enumerate() {
        let header = r == 0;
        let mut tcs = String::new();
        for c in 0..ncols {
            let cell = row.get(c).map(|s| s.as_str()).unwrap_or("");
            let b = if header { r#" b="1""# } else { "" };
            tcs.push_str(&format!(
                r#"<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1200"{b} dirty="0"/><a:t>{t}</a:t></a:r></a:p></a:txBody><a:tcPr marL="45720" marR="45720" marT="22860" marB="22860"><a:lnL w="6350"><a:solidFill><a:srgbClr val="9CA3AF"/></a:solidFill></a:lnL><a:lnR w="6350"><a:solidFill><a:srgbClr val="9CA3AF"/></a:solidFill></a:lnR><a:lnT w="6350"><a:solidFill><a:srgbClr val="9CA3AF"/></a:solidFill></a:lnT><a:lnB w="6350"><a:solidFill><a:srgbClr val="9CA3AF"/></a:solidFill></a:lnB>{fill}</a:tcPr></a:tc>"#,
                t = xml_escape(cell),
                fill = if header { r#"<a:fill><a:solidFill><a:srgbClr val="F3F4F6"/></a:solidFill></a:fill>"# } else { "" },
            ));
        }
        trs.push_str(&format!(r#"<a:tr h="{rowh}">{tcs}</a:tr>"#));
    }

    format!(
        r#"<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="{id}" name="Table {id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/><a:tblGrid>{grid}</a:tblGrid>{trs}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>"#,
    )
}

// ---------- relationships / content types ----------

fn content_types(n: usize, has_notes: &[bool], media_exts: &[&str]) -> String {
    let mut defaults = String::from(
        r#"<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>"#,
    );
    for ext in media_exts {
        let ct = match *ext {
            "jpg" => "image/jpeg",
            "gif" => "image/gif",
            _ => "image/png",
        };
        defaults.push_str(&format!(r#"<Default Extension="{ext}" ContentType="{ct}"/>"#));
    }
    let mut overrides = String::from(
        r#"<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>"#,
    );
    for i in 1..=n {
        overrides.push_str(&format!(
            r#"<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>"#,
        ));
    }
    for (i, notes) in has_notes.iter().enumerate() {
        if *notes {
            overrides.push_str(&format!(
                r#"<Override PartName="/ppt/notesSlides/notesSlide{}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>"#,
                i + 1,
            ));
        }
    }
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">{defaults}{overrides}</Types>"#,
    )
}

fn presentation_xml(n: usize) -> String {
    let mut sld_ids = String::new();
    for i in 1..=n {
        // Slide r:ids start after master(rId1), notesMaster(rId2), presProps(rId3).
        sld_ids.push_str(&format!(r#"<p:sldId id="{}" r:id="rId{}"/>"#, 255 + i, 3 + i));
    }
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst><p:sldIdLst>{sld_ids}</p:sldIdLst><p:sldSz cx="{SLIDE_W}" cy="{SLIDE_H}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>"#,
    )
}

fn presentation_rels(n: usize) -> String {
    let mut rels = String::from(
        r#"<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="notesMasters/notesMaster1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>"#,
    );
    for i in 1..=n {
        rels.push_str(&format!(
            r#"<Relationship Id="rId{}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{}.xml"/>"#,
            3 + i, i,
        ));
    }
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{rels}</Relationships>"#,
    )
}

fn slide_rels(_num: usize, has_notes: bool, media: &[MediaFile], img_rid_start: usize) -> String {
    let mut rels = String::from(
        r#"<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>"#,
    );
    if has_notes {
        rels.push_str(&format!(
            r#"<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide{_num}.xml"/>"#,
        ));
    }
    for (k, m) in media.iter().enumerate() {
        rels.push_str(&format!(
            r#"<Relationship Id="rId{}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/{}"/>"#,
            img_rid_start + k, m.name,
        ));
    }
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{rels}</Relationships>"#,
    )
}

fn notes_slide_xml(notes: &str) -> String {
    let mut paras = String::new();
    for line in notes.split('\n') {
        paras.push_str(&format!(
            r#"<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>{t}</a:t></a:r></a:p>"#,
            t = xml_escape(line),
        ));
    }
    if paras.is_empty() {
        paras.push_str("<a:p/>");
    }
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>{paras}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>"#,
    )
}

fn notes_slide_rels(num: usize) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide{num}.xml"/></Relationships>"#,
    )
}

// ---------- import ----------

/// Parse .pptx bytes into a `Presentation` model. Best-effort ("practical"):
/// slide titles, subtitles, multi-level bullets, tables and speaker notes are
/// recovered. Images and exotic shapes are skipped.
pub fn import(bytes: &[u8]) -> Result<Presentation, String> {
    use zip::ZipArchive;
    let mut zip = ZipArchive::new(Cursor::new(bytes.to_vec())).map_err(|e| e.to_string())?;

    // Slide part names, ordered by their numeric suffix.
    let mut names: Vec<String> = (0..zip.len())
        .filter_map(|i| zip.by_index(i).ok().map(|f| f.name().to_string()))
        .filter(|n| n.starts_with("ppt/slides/slide") && n.ends_with(".xml"))
        .collect();
    names.sort_by_key(|n| slide_number(n));

    let mut slides = Vec::new();
    for name in &names {
        let num = slide_number(name);
        let xml = read_zip_string(&mut zip, name)?;
        let mut slide = parse_slide(&xml);
        // Notes live in a sibling part.
        let notes_name = format!("ppt/notesSlides/notesSlide{num}.xml");
        if let Ok(nxml) = read_zip_string(&mut zip, &notes_name) {
            slide.notes = all_between(&nxml, "<a:t>", "</a:t>")
                .iter()
                .map(|s| xml_unescape(s))
                .collect::<Vec<_>>()
                .join("\n");
        }
        slides.push(slide);
    }

    if slides.is_empty() {
        slides.push(Slide {
            layout: "title".into(),
            title: "Imported".into(),
            ..Default::default()
        });
    }
    Ok(Presentation { slides })
}

fn slide_number(name: &str) -> u32 {
    name.trim_end_matches(".xml")
        .rsplit("slide")
        .next()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0)
}

fn read_zip_string(
    zip: &mut zip::ZipArchive<Cursor<Vec<u8>>>,
    name: &str,
) -> Result<String, String> {
    use std::io::Read;
    let mut f = zip.by_name(name).map_err(|e| e.to_string())?;
    let mut s = String::new();
    f.read_to_string(&mut s).map_err(|e| e.to_string())?;
    Ok(s)
}

fn parse_slide(xml: &str) -> Slide {
    let mut slide = Slide { layout: "titleContent".into(), ..Default::default() };
    let mut content: Vec<SlideBlock> = Vec::new();

    for sp in all_between(xml, "<p:sp>", "</p:sp>") {
        let is_title = sp.contains(r#"type="title""#) || sp.contains(r#"type="ctrTitle""#);
        let is_sub = sp.contains(r#"type="subTitle""#);
        // One bullet per <a:p>, capturing its lvl.
        let mut bullets: Vec<Bullet> = Vec::new();
        let mut plain: Vec<String> = Vec::new();
        for p in all_between(&sp, "<a:p>", "</a:p>") {
            let text = all_between(&p, "<a:t>", "</a:t>")
                .iter()
                .map(|s| xml_unescape(s))
                .collect::<String>();
            if text.trim().is_empty() {
                continue;
            }
            let level = p
                .split("lvl=\"")
                .nth(1)
                .and_then(|s| s.split('"').next())
                .and_then(|s| s.parse::<u8>().ok())
                .unwrap_or(0);
            bullets.push(Bullet { text: text.clone(), level });
            plain.push(text);
        }
        if is_title {
            slide.title = plain.join(" ");
        } else if is_sub {
            slide.subtitle = plain.join(" ");
        } else if !bullets.is_empty() {
            content.push(SlideBlock::Bullets { items: bullets });
        }
    }

    // Tables.
    for tbl in all_between(xml, "<a:tbl>", "</a:tbl>") {
        let mut rows: Vec<Vec<String>> = Vec::new();
        for tr in all_between(&tbl, "<a:tr", "</a:tr>") {
            let cells = all_between(&tr, "<a:tc>", "</a:tc>")
                .iter()
                .map(|tc| {
                    all_between(tc, "<a:t>", "</a:t>")
                        .iter()
                        .map(|s| xml_unescape(s))
                        .collect::<String>()
                })
                .collect::<Vec<_>>();
            if !cells.is_empty() {
                rows.push(cells);
            }
        }
        if !rows.is_empty() {
            content.push(SlideBlock::Table { rows });
        }
    }

    if content.is_empty() && slide.title.is_empty() {
        slide.title = String::new();
    }
    if content.is_empty() && !slide.subtitle.is_empty() {
        slide.layout = "title".into();
    }
    slide.content = content;
    slide
}

/// Collect the substrings between each `open`/`close` delimiter pair. `open`
/// need not be a full tag (e.g. "<a:tr" matches "<a:tr h=...>").
fn all_between(hay: &str, open: &str, close: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = hay;
    while let Some(i) = rest.find(open) {
        let after_open = &rest[i + open.len()..];
        // Skip to the end of the opening tag if `open` wasn't the whole tag.
        let start = match after_open.find('>') {
            Some(g) if !open.ends_with('>') => g + 1,
            _ => 0,
        };
        let body = &after_open[start..];
        if let Some(j) = body.find(close) {
            out.push(body[..j].to_string());
            rest = &body[j + close.len()..];
        } else {
            break;
        }
    }
    out
}

fn xml_unescape(s: &str) -> String {
    s.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

// ---------- static parts ----------

const ROOT_RELS: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>"#;

const PRES_PROPS: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>"#;

const SLIDE_MASTER_RELS: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>"#;

const SLIDE_LAYOUT_RELS: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>"#;

const NOTES_MASTER_RELS: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>"#;

const SLIDE_MASTER: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="4400"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr marL="342900" indent="-342900"><a:buFont typeface="Arial"/><a:buChar char="•"/><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl1pPr><a:lvl2pPr marL="742950" indent="-285750"><a:buFont typeface="Arial"/><a:buChar char="–"/><a:defRPr sz="1600"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl2pPr><a:lvl3pPr marL="1143000" indent="-228600"><a:buFont typeface="Arial"/><a:buChar char="•"/><a:defRPr sz="1400"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl3pPr><a:lvl4pPr marL="1600200" indent="-228600"><a:buFont typeface="Arial"/><a:buChar char="–"/><a:defRPr sz="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl4pPr><a:lvl5pPr marL="2057400" indent="-228600"><a:buFont typeface="Arial"/><a:buChar char="•"/><a:defRPr sz="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl5pPr></p:bodyStyle><p:otherStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:otherStyle></p:txStyles></p:sldMaster>"#;

const SLIDE_LAYOUT: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>"#;

const NOTES_MASTER: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notesMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="990600"/><a:ext cx="5486400" cy="7315200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:notesStyle><a:lvl1pPr><a:defRPr sz="1200"/></a:lvl1pPr></p:notesStyle></p:notesMaster>"#;

const THEME: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>"#;
