/**
 * 错误日志存储后端
 * - 文件位置：.logs/errors.jsonl（JSON Lines 格式）
 * - 每行一条错误记录，便于追加和 grep
 * - 内存索引：前 RECENT_CACHE 条常驻，避免每次读盘
 * - 总条数上限：MAX_LINES，超出后追加时按时间淘汰最旧的
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

export type ErrorLevel = 'client' | 'server' | 'api' | 'resource'

export interface ErrorRecord {
  id: string
  timestamp: number
  level: ErrorLevel
  /** 简短标题 */
  message: string
  /** 堆栈或详情 */
  stack?: string
  /** 来源 URL（页面 / API 路径） */
  url?: string
  /** 错误类型：Error.name */
  type?: string
  /** 用户代理（仅 client 错误） */
  userAgent?: string
  /** 来源 IP（仅 server 错误） */
  ip?: string
  /** HTTP 状态码（仅 server/api 错误） */
  status?: number
  /** 额外上下文 */
  context?: Record<string, unknown>
}

const LOG_DIR = path.resolve(process.cwd(), '.logs')
const LOG_FILE = path.join(LOG_DIR, 'errors.jsonl')

/** 内存中常驻的最近条数（admin 列表查询用） */
const RECENT_CACHE = 200
/** 文件总条数上限；超出时按时间淘汰最旧的 */
const MAX_LINES = 5000
/** 写入时的批处理上限（防 OOM） */
const MAX_FILE_BYTES = 5_000_000 // 5 MB

let writeQueue: Promise<void> = Promise.resolve()

/** 内存索引：最新在前 */
let recentIndex: ErrorRecord[] = []
/** 内存中是否已加载 */
let indexLoaded = false

/** 启动时尝试加载内存索引（失败也不影响） */
async function ensureIndexLoaded(): Promise<void> {
  if (indexLoaded) return
  try {
    const raw = await fs.readFile(LOG_FILE, 'utf-8')
    const lines = raw.split('\n').filter(Boolean)
    const parsed: ErrorRecord[] = []
    for (const line of lines) {
      try {
        const r = JSON.parse(line) as ErrorRecord
        if (r && typeof r.id === 'string' && typeof r.timestamp === 'number') {
          parsed.push(r)
        }
      } catch {
        /* 跳过损坏行 */
      }
    }
    parsed.sort((a, b) => b.timestamp - a.timestamp)
    recentIndex = parsed.slice(0, RECENT_CACHE)
    indexLoaded = true
  } catch {
    indexLoaded = true // 标记已尝试，下次不再读
    recentIndex = []
  }
}

/** 追加一条错误 */
export async function logError(record: Omit<ErrorRecord, 'id' | 'timestamp'>): Promise<ErrorRecord> {
  const full: ErrorRecord = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...record,
  }

  writeQueue = writeQueue
    .then(() => doWrite(full))
    .catch((err) => console.error('[error-store] 写入失败:', err))

  await writeQueue

  // 更新内存索引（最新在前）
  recentIndex.unshift(full)
  if (recentIndex.length > RECENT_CACHE) {
    recentIndex.length = RECENT_CACHE
  }

  return full
}

async function doWrite(record: ErrorRecord) {
  await fs.mkdir(LOG_DIR, { recursive: true })
  const line = JSON.stringify(record) + '\n'
  await fs.appendFile(LOG_FILE, line, 'utf-8')
  await maybeRotate()
}

/** 文件过大或条数超限时清理最旧记录（保留最近 MAX_LINES - 1000 条） */
async function maybeRotate() {
  try {
    const stat = await fs.stat(LOG_FILE)
    if (stat.size < MAX_FILE_BYTES) return
    const raw = await fs.readFile(LOG_FILE, 'utf-8')
    const lines = raw.split('\n').filter(Boolean)
    if (lines.length <= MAX_LINES) return
    const keep = lines.slice(-(MAX_LINES - 1000))
    await fs.writeFile(LOG_FILE, keep.join('\n') + '\n')
    // 同步内存索引
    await reloadIndex()
  } catch {
    /* 忽略 */
  }
}

async function reloadIndex() {
  indexLoaded = false
  await ensureIndexLoaded()
}

export interface ListOptions {
  level?: ErrorLevel
  search?: string
  limit?: number
  offset?: number
}

export interface ListResult {
  items: ErrorRecord[]
  total: number
}

/** 查询错误列表（最新在前） */
export async function listErrors(opts: ListOptions = {}): Promise<ListResult> {
  await ensureIndexLoaded()

  // 内存索引只覆盖最近 RECENT_CACHE 条；超出部分走全量扫描
  if (recentIndex.length < RECENT_CACHE) {
    // 启动早期 + 数据少 → 内存即全量
    return filterAndPaginate(recentIndex, opts)
  }

  // 常规路径：内存 + 文件拼接（offset 较大时退化到全量读）
  const offset = opts.offset ?? 0
  const limit = opts.limit ?? 50
  if (offset + limit <= recentIndex.length) {
    return filterAndPaginate(recentIndex, opts)
  }

  // 超过内存范围 → 读全量
  const all = await readAllFromDisk()
  return filterAndPaginate(all, opts)
}

function filterAndPaginate(all: ErrorRecord[], opts: ListOptions): ListResult {
  let filtered = all
  if (opts.level) filtered = filtered.filter((r) => r.level === opts.level)
  if (opts.search) {
    const q = opts.search.toLowerCase()
    filtered = filtered.filter(
      (r) =>
        r.message.toLowerCase().includes(q) ||
        (r.url ?? '').toLowerCase().includes(q) ||
        (r.stack ?? '').toLowerCase().includes(q)
    )
  }
  const total = filtered.length
  const offset = opts.offset ?? 0
  const limit = opts.limit ?? 50
  const items = filtered.slice(offset, offset + limit)
  return { items, total }
}

async function readAllFromDisk(): Promise<ErrorRecord[]> {
  const result: ErrorRecord[] = []
  try {
    const raw = await fs.readFile(LOG_FILE, 'utf-8')
    for (const line of raw.split('\n')) {
      if (!line) continue
      try {
        const r = JSON.parse(line) as ErrorRecord
        if (r && typeof r.id === 'string') result.push(r)
      } catch {
        /* 跳过 */
      }
    }
    result.sort((a, b) => b.timestamp - a.timestamp)
  } catch {
    /* 忽略 */
  }
  return result
}

/** 统计概览 */
export interface Stats {
  total: number
  byLevel: Record<ErrorLevel, number>
  recent24h: number
  topPaths: { url: string; count: number }[]
}

export async function getStats(): Promise<Stats> {
  // 统计走全量（必须看到全部）
  const all = await readAllFromDisk()

  const byLevel: Record<ErrorLevel, number> = {
    client: 0,
    server: 0,
    api: 0,
    resource: 0,
  }
  const pathMap = new Map<string, number>()
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  let recent24h = 0

  for (const r of all) {
    byLevel[r.level] = (byLevel[r.level] ?? 0) + 1
    if (r.url) pathMap.set(r.url, (pathMap.get(r.url) ?? 0) + 1)
    if (r.timestamp >= dayAgo) recent24h++
  }

  const topPaths = [...pathMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([url, count]) => ({ url, count }))

  return { total: all.length, byLevel, recent24h, topPaths }
}

/** 按 ID 获取单条 */
export async function getError(id: string): Promise<ErrorRecord | null> {
  await ensureIndexLoaded()
  const hit = recentIndex.find((r) => r.id === id)
  if (hit) return hit
  // 兜底：扫盘
  const all = await readAllFromDisk()
  return all.find((r) => r.id === id) ?? null
}

/** 删除单条 */
export async function deleteError(id: string): Promise<boolean> {
  let removed = false
  try {
    const raw = await fs.readFile(LOG_FILE, 'utf-8')
    const lines = raw.split('\n')
    const filtered: string[] = []
    for (const line of lines) {
      if (!line) continue
      try {
        const r = JSON.parse(line)
        if (r && r.id === id) {
          removed = true
          continue
        }
        filtered.push(line)
      } catch {
        filtered.push(line)
      }
    }
    await fs.writeFile(LOG_FILE, filtered.join('\n') + '\n')
    await reloadIndex()
    return removed
  } catch {
    return false
  }
}

/** 清空所有 */
export async function clearAll(): Promise<void> {
  try {
    await fs.unlink(LOG_FILE)
  } catch {
    /* 忽略 */
  }
  recentIndex = []
  indexLoaded = true
}
