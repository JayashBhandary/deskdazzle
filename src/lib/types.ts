// TS mirror of the Rust core's serde types (camelCase wire format).

export type Priority = 'none' | 'low' | 'medium' | 'high'
export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Recurrence {
  freq: Freq
  interval: number
}

export interface Task {
  id: string
  projectId: string
  title: string
  notes: string
  done: boolean
  priority: Priority
  /** epoch ms, UTC */
  due: number | null
  tags: string[]
  parentId: string | null
  order: number
  createdMs: number
  completedMs: number | null
  recurrence: Recurrence | null
}

export interface Project {
  id: string
  name: string
  color: string
  order: number
}

export interface Note {
  id: string
  title: string
  body: string
  tags: string[]
  createdMs: number
  updatedMs: number
}

export interface DockItem {
  id: string
  kind: 'link' | 'module' | 'note'
  label: string
  /** url for links, route for modules */
  target: string
  icon: string
  order: number
}

export interface ParseResult {
  title: string
  priority: Priority
  tags: string[]
  due: number | null
  recurrence: Recurrence | null
}

export interface SmartViews {
  overdue: Task[]
  today: Task[]
  upcoming: Task[]
  someday: Task[]
}

export interface SearchDoc {
  id: string
  kind: 'task' | 'note'
  title: string
  body: string
  tags: string[]
}

export interface SearchHit {
  id: string
  kind: 'task' | 'note'
  score: number
  snippet: string
}
