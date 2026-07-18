/* tslint:disable */
/* eslint-disable */

/**
 * Run a text/data conversion. See `crate::convert_text` for `kind` values.
 */
export function convert_text(kind: string, input: string): string;

/**
 * Given a completed recurring task, return the next occurrence as JSON `Task`,
 * or the JSON literal `null` when the task does not recur.
 */
export function next_occurrence(task_json: string): string;

/**
 * Parse a natural-language quick-add string. Returns JSON `ParseResult`.
 */
export function quick_parse(input: string, now_ms: number): string;

/**
 * Full-text search across tasks + notes. Returns JSON `SearchHit[]`.
 */
export function search(query: string, docs_json: string): string;

/**
 * Bucket tasks into Today / Upcoming / Someday / Overdue. Returns JSON `SmartViews`.
 */
export function smart_views(tasks_json: string, now_ms: number): string;

/**
 * Sort tasks by urgency. Returns JSON `Task[]`.
 */
export function sort_tasks(tasks_json: string): string;

/**
 * Semver of the core, surfaced in the UI/about.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly convert_text: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly next_occurrence: (a: number, b: number) => [number, number, number, number];
    readonly quick_parse: (a: number, b: number, c: number) => [number, number, number, number];
    readonly search: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly smart_views: (a: number, b: number, c: number) => [number, number, number, number];
    readonly sort_tasks: (a: number, b: number) => [number, number, number, number];
    readonly version: () => [number, number];
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
