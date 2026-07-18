// Lazy, singleton loader + typed wrapper around the Rust/WASM core.
// The wasm binary is fetched once (eagerly on first page load, see main.jsx),
// then all calls are sync. The service worker precaches the .wasm, so this
// works fully offline after the first visit.

import init, {
  quick_parse,
  smart_views as smart_views_raw,
  sort_tasks as sort_tasks_raw,
  next_occurrence as next_occurrence_raw,
  search as search_raw,
  convert_text as convert_text_raw,
  version as version_raw,
} from '@core/pocketknife_core.js'
// `?url` lets Vite hash + serve the wasm as a static asset (works offline
// once cached by the service worker).
import wasmUrl from '@core/pocketknife_core_bg.wasm?url'

import type {
  ParseResult,
  SearchDoc,
  SearchHit,
  SmartViews,
  Task,
} from './types'

let ready: Promise<void> | null = null

/** Idempotent init. Safe to await from many call sites; runs once. */
export function loadCore(): Promise<void> {
  if (!ready) {
    ready = init({ module_or_path: wasmUrl }).then(() => undefined)
  }
  return ready
}

export type ConvertKind =
  | 'md2html'
  | 'csv2json'
  | 'json2yaml'
  | 'yaml2json'
  | 'base64enc'
  | 'base64dec'
  | 'urlenc'
  | 'urldec'

export const core = {
  async quickParse(input: string, now = Date.now()): Promise<ParseResult> {
    await loadCore()
    return JSON.parse(quick_parse(input, now))
  },

  async smartViews(tasks: Task[], now = Date.now()): Promise<SmartViews> {
    await loadCore()
    return JSON.parse(smart_views_raw(JSON.stringify(tasks), now))
  },

  async sortTasks(tasks: Task[]): Promise<Task[]> {
    await loadCore()
    return JSON.parse(sort_tasks_raw(JSON.stringify(tasks)))
  },

  /** Next occurrence of a completed recurring task, or null. */
  async nextOccurrence(task: Task): Promise<Task | null> {
    await loadCore()
    return JSON.parse(next_occurrence_raw(JSON.stringify(task)))
  },

  async search(query: string, docs: SearchDoc[]): Promise<SearchHit[]> {
    await loadCore()
    return JSON.parse(search_raw(query, JSON.stringify(docs)))
  },

  /** Throws with the core's error string on invalid input. */
  async convert(kind: ConvertKind, input: string): Promise<string> {
    await loadCore()
    return convert_text_raw(kind, input)
  },

  async version(): Promise<string> {
    await loadCore()
    return version_raw()
  },
}
