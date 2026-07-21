/* tslint:disable */
/* eslint-disable */

/**
 * Grid JSON -> CSV text.
 */
export function csv_export(rows_json: string): string;

/**
 * CSV text -> grid JSON.
 */
export function csv_import(text: string): string;

/**
 * Model JSON -> .xlsx bytes.
 */
export function excel_export(model_json: string): Uint8Array;

/**
 * Spreadsheet bytes (.xlsx/.xls/.xlsb/.ods) -> model JSON.
 */
export function excel_import(bytes: Uint8Array): string;

/**
 * Workbook model JSON -> .pdf bytes.
 */
export function excel_pdf(model_json: string): Uint8Array;

/**
 * Merge PDF `a` followed by PDF `b`.
 */
export function pdf_merge(a: Uint8Array, b: Uint8Array): Uint8Array;

/**
 * Reorder / delete / rotate / extract PDF pages.
 */
export function pdf_organize(bytes: Uint8Array, ops_json: string): Uint8Array;

/**
 * Number of pages in a PDF.
 */
export function pdf_page_count(bytes: Uint8Array): number;

/**
 * Presentation model JSON -> .pptx bytes.
 */
export function ppt_export(model_json: string): Uint8Array;

/**
 * .pptx bytes -> presentation model JSON.
 */
export function ppt_import(bytes: Uint8Array): string;

/**
 * Presentation model JSON -> .pdf bytes.
 */
export function ppt_pdf(model_json: string): Uint8Array;

/**
 * Crate version, for a quick "wasm alive" check from the UI.
 */
export function version(): string;

/**
 * Model JSON -> .docx bytes.
 */
export function word_export(model_json: string): Uint8Array;

/**
 * .docx bytes -> model JSON.
 */
export function word_import(bytes: Uint8Array): string;

/**
 * Word model JSON -> .pdf bytes.
 */
export function word_pdf(model_json: string): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly csv_export: (a: number, b: number) => [number, number, number, number];
    readonly csv_import: (a: number, b: number) => [number, number, number, number];
    readonly excel_export: (a: number, b: number) => [number, number, number, number];
    readonly excel_import: (a: number, b: number) => [number, number, number, number];
    readonly excel_pdf: (a: number, b: number) => [number, number, number, number];
    readonly pdf_merge: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly pdf_organize: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly pdf_page_count: (a: number, b: number) => [number, number, number];
    readonly ppt_export: (a: number, b: number) => [number, number, number, number];
    readonly ppt_import: (a: number, b: number) => [number, number, number, number];
    readonly ppt_pdf: (a: number, b: number) => [number, number, number, number];
    readonly version: () => [number, number];
    readonly word_export: (a: number, b: number) => [number, number, number, number];
    readonly word_import: (a: number, b: number) => [number, number, number, number];
    readonly word_pdf: (a: number, b: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
