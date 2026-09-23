/**
 * 阅读器本地偏好设置 —— 基于 localStorage 持久化（仅保存在本机浏览器）
 *
 * 存储内容：
 * 1. settings    全局开关：自动打开上次文件 / 记住阅读位置 / 恢复缩放比例
 * 2. files       每个文件各自的阅读状态（页码、缩放），按文件 key 隔离，互不串用
 * 3. lastOpened  上次打开文件的引用，用于启动时自动恢复
 *
 * 文件 key 规则：
 * - public 下的示例文件：`sample:<文件名>`
 * - 用户本机选择/拖入的文件：`local:<文件名>:<大小>:<最后修改时间>`
 *   （blob URL 在刷新后失效，本机文件本身无法自动重新打开，但同一文件再次
 *   被选择时 key 相同，其页码/缩放记录仍可恢复）
 */

const STORAGE_KEY = 'pdf-viewer:prefs:v1'
const MAX_FILE_RECORDS = 50

/** 未保存过缩放时的默认值，与阅读器初始缩放保持一致 */
export const DEFAULT_SCALE = 1.5
const MIN_SCALE = 0.25
const MAX_SCALE = 5

export interface ReaderSettings {
  /** 启动时自动打开上次阅读的文件 */
  autoOpenLastFile: boolean
  /** 记住每个文件的阅读页码 */
  rememberPage: boolean
  /** 记住每个文件的缩放比例 */
  restoreZoom: boolean
}

export interface FileReadingState {
  page: number
  scale: number
  updatedAt: number
}

export interface LastFileRef {
  kind: 'sample' | 'local'
  name: string
  key: string
}

interface PrefsShape {
  version: 1
  settings: ReaderSettings
  files: Record<string, FileReadingState>
  lastOpened: LastFileRef | null
}

const DEFAULT_SETTINGS: ReaderSettings = {
  autoOpenLastFile: true,
  rememberPage: true,
  restoreZoom: true,
}

function defaultPrefs(): PrefsShape {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, files: {}, lastOpened: null }
}

/* ---- 数据清洗：localStorage 可能被清空、损坏或写入旧格式 ---- */

function normalizeSettings(raw: unknown): ReaderSettings {
  const o = (raw ?? {}) as Record<string, unknown>
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
  return {
    autoOpenLastFile: bool(o.autoOpenLastFile, DEFAULT_SETTINGS.autoOpenLastFile),
    rememberPage: bool(o.rememberPage, DEFAULT_SETTINGS.rememberPage),
    restoreZoom: bool(o.restoreZoom, DEFAULT_SETTINGS.restoreZoom),
  }
}

function normalizeFileState(raw: unknown): FileReadingState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const page = Number(o.page)
  const scale = Number(o.scale)
  if (!Number.isFinite(page) && !Number.isFinite(scale)) return null
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    scale: Number.isFinite(scale) && scale >= MIN_SCALE && scale <= MAX_SCALE
      ? +scale.toFixed(2)
      : DEFAULT_SCALE,
    updatedAt: Number.isFinite(Number(o.updatedAt)) ? Number(o.updatedAt) : Date.now(),
  }
}

function normalizeLastOpened(raw: unknown): LastFileRef | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const kind = o.kind === 'sample' ? 'sample' : o.kind === 'local' ? 'local' : null
  if (!kind) return null
  const name = typeof o.name === 'string' ? o.name : ''
  const key = typeof o.key === 'string' ? o.key : ''
  if (!name || !key) return null
  return { kind, name, key }
}

function readPrefs(): PrefsShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultPrefs()
    const data = JSON.parse(raw) as Partial<PrefsShape>

    const files: Record<string, FileReadingState> = {}
    if (data.files && typeof data.files === 'object') {
      for (const [key, value] of Object.entries(data.files as Record<string, unknown>)) {
        const state = normalizeFileState(value)
        if (state) files[key] = state
      }
    }

    return {
      version: 1,
      settings: normalizeSettings(data.settings),
      files,
      lastOpened: normalizeLastOpened(data.lastOpened),
    }
  } catch {
    // JSON 损坏等情况：回退默认值，不阻塞阅读器使用
    return defaultPrefs()
  }
}

function writePrefs(prefs: PrefsShape): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // 隐私模式 / 存储被禁用：静默忽略，不影响阅读
  }
}

/* ---- 对外接口 ---- */

export function getSettings(): ReaderSettings {
  return { ...readPrefs().settings }
}

export function saveSettings(patch: Partial<ReaderSettings>): void {
  const prefs = readPrefs()
  prefs.settings = { ...prefs.settings, ...patch }
  writePrefs(prefs)
}

export function getFileState(key: string): FileReadingState | null {
  if (!key) return null
  return readPrefs().files[key] ?? null
}

export function saveFileState(key: string, patch: Partial<FileReadingState>): void {
  if (!key) return
  const prefs = readPrefs()
  const prev = prefs.files[key]
  prefs.files[key] = {
    page: prev?.page ?? 1,
    scale: prev?.scale ?? DEFAULT_SCALE,
    ...patch,
    updatedAt: patch.updatedAt ?? Date.now(),
  }

  // 记录过多时淘汰最久未更新的，避免 localStorage 无限增长
  const keys = Object.keys(prefs.files)
  if (keys.length > MAX_FILE_RECORDS) {
    keys.sort((a, b) => prefs.files[a].updatedAt - prefs.files[b].updatedAt)
    for (let i = 0; i < keys.length - MAX_FILE_RECORDS; i++) {
      delete prefs.files[keys[i]]
    }
  }

  writePrefs(prefs)
}

export function getLastOpened(): LastFileRef | null {
  return readPrefs().lastOpened
}

export function setLastOpened(ref: LastFileRef | null): void {
  const prefs = readPrefs()
  prefs.lastOpened = ref
  writePrefs(prefs)
}
