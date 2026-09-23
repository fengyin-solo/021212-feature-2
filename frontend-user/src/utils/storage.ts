/**
 * 阅读偏好与阅读状态的本地持久化。
 *
 * 数据保存在浏览器 localStorage（本机），重新打开阅读器时与本地记录保持一致。
 * 三类数据：
 *  1. 设置（全局唯一）
 *  2. 每个文件的阅读状态（页码、缩放），按文件 key 隔离，换文件互不干扰
 *  3. 上次打开的文件（用于自动恢复）
 */

/** 用户可调整的使用偏好 */
export interface ViewerSettings {
  /** 启动时自动打开上次阅读的文件 */
  autoOpenLastFile: boolean
  /** 记住每个文件的阅读位置（页码） */
  rememberPage: boolean
  /** 恢复每个文件上次使用的缩放比例 */
  rememberScale: boolean
}

/** 单个文件的阅读状态；关闭对应开关后该字段为 null */
export interface FileViewState {
  page: number | null
  scale: number | null
}

/** 上次打开文件的描述 */
export interface LastFileRef {
  /** sample: public 目录内置示例；local: 用户本机选择的文件 */
  kind: 'sample' | 'local'
  /** sample 为文件名；local 为文件指纹（名-大小-最后修改时间） */
  key: string
  /** 展示用文件名 */
  name: string
  updatedAt: number
}

const SETTINGS_KEY = 'pdf-viewer:settings:v1'
const STATE_PREFIX = 'pdf-viewer:state:v1:'
const LAST_FILE_KEY = 'pdf-viewer:last-file:v1'

/** 兼容旧版本 / 数据损坏时的默认值 */
export const DEFAULT_SETTINGS: ViewerSettings = {
  autoOpenLastFile: false,
  rememberPage: true,
  rememberScale: true,
}

export const MIN_SCALE = 0.25
export const MAX_SCALE = 5
export const DEFAULT_SCALE = 1.5

/* ---------------- 基础读写（带容错，损坏数据不影响启动） ---------------- */

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 隐私模式 / 存储已满等情况下静默降级，功能仍可在当前会话内使用 */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/* -------------------------------- 设置 -------------------------------- */

export function loadSettings(): ViewerSettings {
  const raw = readJSON<Partial<ViewerSettings>>(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...(raw ?? {}) }
}

export function saveSettings(settings: ViewerSettings): void {
  writeJSON(SETTINGS_KEY, settings)
}

/* ----------------------------- 单文件阅读状态 ----------------------------- */

/** 读取某文件记录的阅读状态；无记录或数据损坏时返回 null（缺失字段为 null） */
export function loadFileState(fileKey: string): FileViewState | null {
  const raw = readJSON<Partial<FileViewState>>(STATE_PREFIX + fileKey)
  if (!raw) return null
  return {
    page: typeof raw.page === 'number' ? raw.page : null,
    scale: typeof raw.scale === 'number' ? raw.scale : null,
  }
}

export function saveFileState(fileKey: string, state: FileViewState): void {
  writeJSON(STATE_PREFIX + fileKey, state)
}

export function clearFileState(fileKey: string): void {
  remove(STATE_PREFIX + fileKey)
}

/* ------------------------------ 上次文件 ------------------------------ */

export function loadLastFile(): LastFileRef | null {
  return readJSON<LastFileRef>(LAST_FILE_KEY)
}

export function saveLastFile(ref: LastFileRef): void {
  writeJSON(LAST_FILE_KEY, ref)
}

export function clearLastFile(): void {
  remove(LAST_FILE_KEY)
}

/**
 * 清除全部本机记录（设置恢复默认）。
 * 文件状态按前缀散落在多个 key 中，需要遍历清理。
 */
export function clearAllRecords(): void {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k === SETTINGS_KEY || k === LAST_FILE_KEY || k.startsWith(STATE_PREFIX))) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach(remove)
  } catch {
    /* ignore */
  }
}

/* ------------------------------ 工具函数 ------------------------------ */

/** 本机文件的稳定指纹：同名不同内容也算不同文件，避免状态串文件 */
export function getLocalFileKey(file: File): string {
  return `local:${file.name}:${file.size}:${file.lastModified}`
}

/** 内置示例文件的 key */
export function getSampleFileKey(name: string): string {
  return `sample:${name}`
}

/** 将缩放值约束在合法范围内；非法值回退默认 */
export function clampScale(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_SCALE
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, n))
}
