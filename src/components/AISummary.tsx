/** @jsxImportSource react */
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

export interface AISummaryProps {
  slug: string
  title: string
  content: string
  /** 构建时已生成的摘要（如有） */
  initialSummary?: string
}

const CACHE_KEY = 'blog-ai-summaries'
const CACHE_VERSION = 1
const CACHE_TTL_DAYS = 30

interface CacheEntry {
  summary: string
  savedAt: number
  source: 'build' | 'api'
}

type CacheMap = Record<string, CacheEntry>

/** 读 localStorage 缓存（带版本校验，过期丢弃） */
function readLocalCache(): CacheMap {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { version: number; entries: CacheMap }
    if (parsed.version !== CACHE_VERSION) return {}
    const ttl = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
    const now = Date.now()
    const fresh: CacheMap = {}
    for (const [slug, entry] of Object.entries(parsed.entries)) {
      if (now - entry.savedAt < ttl) fresh[slug] = entry
    }
    return fresh
  } catch {
    return {}
  }
}

/** 写 localStorage 缓存（写入前先剔除过期条目，避免 QuotaExceededError） */
function writeLocalCache(slug: string, summary: string, source: 'api') {
  if (typeof localStorage === 'undefined') return
  try {
    const current = readLocalCache() // 已自带过期清理
    current[slug] = { summary, savedAt: Date.now(), source }
    // 兜底：如果写入仍超限，丢弃最旧的 1/3
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ version: CACHE_VERSION, entries: current })
      )
    } catch {
      const keys = Object.keys(current)
      if (keys.length > 3) {
        // 按 savedAt 升序排序后丢前 1/3
        const sorted = keys.sort(
          (a, b) => (current[a]?.savedAt ?? 0) - (current[b]?.savedAt ?? 0)
        )
        const drop = Math.max(1, Math.floor(sorted.length / 3))
        for (const k of sorted.slice(0, drop)) delete current[k]
        // 当前条目重新加回（防止上面被清掉）
        current[slug] = { summary, savedAt: Date.now(), source }
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ version: CACHE_VERSION, entries: current })
          )
        } catch {
          /* 实在写不下就放弃 */
        }
      }
    }
  } catch {
    /* 写入失败忽略 */
  }
}

/**
 * AI 摘要组件
 * 数据来源优先级：
 *   1. 构建时缓存（initialSummary，从 .cache/summaries.json 注入）
 *   2. localStorage 缓存（之前生成过）
 *   3. 服务端 API（首次访问时获取）
 *
 * 失败行为：静默降级——只显示折叠按钮，不显示错误条
 */
export default function AISummary({ slug, title, content, initialSummary }: AISummaryProps) {
  const [summary, setSummary] = useState<string | null>(initialSummary ?? null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'regenerating' | 'unavailable'>(
    initialSummary ? 'idle' : 'loading'
  )
  const [collapsed, setCollapsed] = useState(false)
  const [source, setSource] = useState<'build' | 'cache' | 'api' | null>(
    initialSummary ? 'build' : null
  )
  const triedApiRef = useRef(false)

  // 首次加载：构建时没有 → 查 localStorage → 查 API
  useEffect(() => {
    if (initialSummary || triedApiRef.current) return
    triedApiRef.current = true

    // 1. 查 localStorage
    const local = readLocalCache()
    if (local[slug]?.summary) {
      setSummary(local[slug].summary)
      setSource('cache')
      setStatus('idle')
      return
    }

    // 2. 查 API（GET 查缓存；miss 时调用 LLM）
    let aborted = false
    async function load() {
      try {
        const r = await fetch(`/api/summarize?slug=${encodeURIComponent(slug)}`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const data = await r.json()
        if (aborted) return
        if (data.summary) {
          setSummary(data.summary)
          setSource('cache')
          setStatus('idle')
          return
        }
        // API 缓存 miss → 客户端触发 POST 生成
        await generate()
      } catch {
        if (aborted) return
        // 失败：静默降级，UI 上仍可点"重新生成"
        setStatus('unavailable')
      }
    }
    load()
    return () => {
      aborted = true
    }
  }, [slug, initialSummary])

  async function generate() {
    setStatus('regenerating')
    try {
      const r = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, title, content }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
      setSummary(data.summary)
      setSource('api')
      setStatus('idle')
      writeLocalCache(slug, data.summary, 'api')
    } catch {
      setStatus('unavailable')
    }
  }

  // 完全不可用时：仍保留折叠按钮（用户可点"重新生成"重试）
  if (!summary && status === 'unavailable') {
    return (
      <div className="my-6 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="bot" size={18} className="text-gray-400" />
            <span className="text-sm text-gray-500">AI 摘要</span>
            <span className="text-[10px] text-gray-400">暂不可用</span>
          </div>
          <button
            onClick={generate}
            className="text-xs text-brand-600 hover:underline flex items-center gap-1"
            title="重试"
          >
            <Icon name="refresh" size={12} />重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="my-6 rounded-lg border border-brand-200 dark:border-brand-800 bg-gradient-to-br from-brand-50/50 to-white dark:from-brand-900/10 dark:to-gray-900 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-brand-50/50 dark:hover:bg-brand-900/20 transition-colors"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <Icon name="bot" size={18} className="text-brand-600" />
          <span className="font-semibold text-sm text-brand-700 dark:text-brand-300">
            AI 摘要
          </span>
          {status === 'loading' || status === 'regenerating' ? (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Icon name="loading" size={12} />
              生成中
            </span>
          ) : source === 'build' ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              构建时生成
            </span>
          ) : source === 'api' ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              运行时生成
            </span>
          ) : source === 'cache' ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              本地缓存
            </span>
          ) : null}
        </div>
        <span className="text-gray-500">
          <Icon name={collapsed ? 'chevron-down' : 'chevron-up'} size={16} className="transition-transform" />
        </span>
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="px-4 pb-4">
          {summary ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {summary}
            </p>
          ) : (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-5/6"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-4/6"></div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={generate}
              disabled={status === 'regenerating'}
              className="text-xs text-gray-500 hover:text-brand-600 flex items-center gap-1 disabled:opacity-50"
              title="重新生成"
            >
              <Icon name={status === 'regenerating' ? 'loading' : 'refresh'} size={12} />
              重新生成
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
