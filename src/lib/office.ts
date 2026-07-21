// Lazy, singleton loader + typed wrapper around the Office Rust/WASM core
// (a second, independent module alongside pocketknife_core). It reads and
// writes real .docx / .xlsx files against a small native document model — the
// React apps only ever touch that model, never the OOXML.
//
// The wasm binary (~2.7MB) is only fetched when `loadOffice()` first runs, i.e.
// when the user actually opens the Word or Excel app — the glue JS below is
// tiny and pulling it into the bundle costs nothing until init() is called.

import init, {
  word_export as word_export_raw,
  word_import as word_import_raw,
  excel_export as excel_export_raw,
  excel_import as excel_import_raw,
  word_pdf as word_pdf_raw,
  excel_pdf as excel_pdf_raw,
  ppt_export as ppt_export_raw,
  ppt_import as ppt_import_raw,
  ppt_pdf as ppt_pdf_raw,
  pdf_page_count as pdf_page_count_raw,
  pdf_merge as pdf_merge_raw,
  pdf_organize as pdf_organize_raw,
  csv_export as csv_export_raw,
  csv_import as csv_import_raw,
  version as version_raw,
} from '@office/office_core.js'
import wasmUrl from '@office/office_core_bg.wasm?url'

let ready: Promise<void> | null = null

/** Idempotent init. Runs once; safe to await from many call sites. */
export function loadOffice(): Promise<void> {
  if (!ready) {
    ready = init({ module_or_path: wasmUrl }).then(() => undefined)
  }
  return ready
}

// ---- Word model (mirrors office/src/model.rs) ----

export interface WordRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

export type WordBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; runs: WordRun[]; align?: 'left' | 'center' | 'right' | 'justify' }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; rows: string[][] }

export interface WordDoc {
  blocks: WordBlock[]
}

// ---- Excel model (mirrors office/src/model.rs) ----

export interface Sheet {
  name: string
  rows: string[][]
}

export interface Workbook {
  sheets: Sheet[]
}

// ---- PowerPoint model (mirrors office/src/model.rs) ----

export type SlideLayout = 'title' | 'titleContent' | 'section' | 'blank'

export interface Bullet {
  text: string
  level: number
}

export type SlideBlock =
  | { type: 'bullets'; items: Bullet[] }
  | { type: 'image'; data: string; mime: string }
  | { type: 'table'; rows: string[][] }

export interface Slide {
  layout: SlideLayout
  title: string
  subtitle: string
  content: SlideBlock[]
  notes: string
}

export interface Presentation {
  slides: Slide[]
}

export const office = {
  /** WordDoc model → .docx bytes. */
  async wordExport(doc: WordDoc): Promise<Uint8Array> {
    await loadOffice()
    return word_export_raw(JSON.stringify(doc))
  },

  /** .docx bytes → WordDoc model. Throws on a corrupt/unsupported file. */
  async wordImport(bytes: Uint8Array): Promise<WordDoc> {
    await loadOffice()
    return JSON.parse(word_import_raw(bytes))
  },

  /** Workbook model → .xlsx bytes. */
  async excelExport(wb: Workbook): Promise<Uint8Array> {
    await loadOffice()
    return excel_export_raw(JSON.stringify(wb))
  },

  /** Spreadsheet bytes (.xlsx/.xls/.xlsb/.ods) → Workbook model. */
  async excelImport(bytes: Uint8Array): Promise<Workbook> {
    await loadOffice()
    return JSON.parse(excel_import_raw(bytes))
  },

  /** WordDoc model → .pdf bytes (a printable rendering of the document). */
  async wordPdf(doc: WordDoc): Promise<Uint8Array> {
    await loadOffice()
    return word_pdf_raw(JSON.stringify(doc))
  },

  /** Workbook model → .pdf bytes (one section per sheet). */
  async excelPdf(wb: Workbook): Promise<Uint8Array> {
    await loadOffice()
    return excel_pdf_raw(JSON.stringify(wb))
  },

  /** Presentation model → .pptx bytes. */
  async pptExport(pres: Presentation): Promise<Uint8Array> {
    await loadOffice()
    return ppt_export_raw(JSON.stringify(pres))
  },

  /** .pptx bytes → Presentation model (text/tables/notes; images skipped). */
  async pptImport(bytes: Uint8Array): Promise<Presentation> {
    await loadOffice()
    return JSON.parse(ppt_import_raw(bytes))
  },

  /** Presentation model → .pdf bytes (one page per slide). */
  async pptPdf(pres: Presentation): Promise<Uint8Array> {
    await loadOffice()
    return ppt_pdf_raw(JSON.stringify(pres))
  },

  // ---- existing-PDF editing ----

  /** Number of pages in a PDF. */
  async pdfPageCount(bytes: Uint8Array): Promise<number> {
    await loadOffice()
    return pdf_page_count_raw(bytes)
  },

  /** Merge PDF `a` followed by PDF `b`. */
  async pdfMerge(a: Uint8Array, b: Uint8Array): Promise<Uint8Array> {
    await loadOffice()
    return pdf_merge_raw(a, b)
  },

  /** Merge a list of PDFs in order (folds pdfMerge). */
  async pdfMergeAll(list: Uint8Array[]): Promise<Uint8Array> {
    await loadOffice()
    if (list.length === 0) throw new Error('nothing to merge')
    let acc = list[0]
    for (let i = 1; i < list.length; i++) acc = pdf_merge_raw(acc, list[i])
    return acc
  },

  /**
   * Reorder / delete / rotate / extract pages. `ops` is the desired output
   * order; each entry names a 0-based source page and an optional rotation.
   */
  async pdfOrganize(
    bytes: Uint8Array,
    ops: { page: number; rotate?: number }[],
  ): Promise<Uint8Array> {
    await loadOffice()
    return pdf_organize_raw(bytes, JSON.stringify(ops))
  },

  /** CSV text → grid of cell strings (a single table). */
  async csvImport(text: string): Promise<string[][]> {
    await loadOffice()
    return JSON.parse(csv_import_raw(text))
  },

  /** Grid of cell strings → CSV text. */
  async csvExport(rows: string[][]): Promise<string> {
    await loadOffice()
    return csv_export_raw(JSON.stringify(rows))
  },

  async version(): Promise<string> {
    await loadOffice()
    return version_raw()
  },
}

// ---- File download / open helpers (shared by both office apps) ----

export const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv;charset=utf-8',
  pdf: 'application/pdf',
} as const

/** Trigger a browser download of `text` as `filename`. */
export function downloadText(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Read a File/Blob as UTF-8 text (for CSV import). */
export async function readFileText(file: Blob): Promise<string> {
  return await file.text()
}

/** Trigger a browser download of `bytes` as `filename`. */
export function downloadBytes(bytes: Uint8Array, filename: string, mime: string): void {
  const blob = new Blob([bytes.slice()], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick so the click has definitely started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Read a File/Blob into a Uint8Array (for import). */
export async function readFileBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}
