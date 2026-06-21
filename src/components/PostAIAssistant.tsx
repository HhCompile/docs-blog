/** @jsxImportSource react */
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

export interface PostAIAssistantProps {
  postTitle: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: { title: string; url: string }[]
  createdAt: number
}

interface ChatHistory {
  version: 1
  // slug → 该文章下最近的消息
  threads: Record<string, ChatMessage[]>
}

const STORAGE_KEY = 'blog-ai-history'
const TTL_DAYS = 7
const MAX_MESSAGES_PER_THREAD = 30 // 约 15 轮

function loadHistory(): ChatHistory {
  if (typeof localStorage === 'undefined') return { version: 1, threads: {} }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: 1, threads: {} }
    const parsed = JSON.parse(raw) as ChatHistory
    if (parsed.version !== 1) return { version: 1, threads: {} }
    // TTL 清理
    const now = Date.now()
    const ttl = TTL_DAYS * 24 * 60 * 60 * 1000
    const fresh: typeof parsed.threads = {}
    for (const [slug, msgs] of Object.entries(parsed.threads)) {
      const alive = msgs.filter((m) => now - m.createdAt < ttl)
      if (alive.length > 0) fresh[slug] = alive
    }
    return { version: 1, threads: fresh }
  } catch {
    return { version: 1, threads: {} }
  }
}

function saveHistory(history: ChatHistory) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    /* 配额超限等，忽略 */
  }
}

/**
 * 文章页 AI 助手 - 小弹窗
 *
 * 形态：右下角小气泡（FAB）→ 点击展开右侧浮窗
 * 能力：流式打字机回答，多轮对话，按文章隔离持久化（7 天）
 */
export default function PostAIAssistant({ postTitle }: PostAIAssistantProps) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiOnline, setAiOnline] = useState<boolean | null>(null)
  // 用 ref 持有当前文章的 slug（持久化 key）
  const slugRef = useRef<string>('')
  // 消息列表（按文章隔离）
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const healthCheckedRef = useRef(false)

  // 从 path 提取 slug（首次渲染）
  useEffect(() => {
    if (typeof location !== 'undefined') {
      const m = location.pathname.match(/\/posts\/([^/]+)/)
      if (m) slugRef.current = m[1]
    }
    const hist = loadHistory()
    const slug = slugRef.current
    if (slug && hist.threads[slug]) {
      setMessages(hist.threads[slug])
    }
  }, [])

  // 持久化消息变更
  useEffect(() => {
    if (!slugRef.current) return
    const hist = loadHistory()
    hist.threads[slugRef.current] = messages.slice(-MAX_MESSAGES_PER_THREAD)
    saveHistory(hist)
  }, [messages])

  // 打开时检测 LM Studio 健康（只检查一次）
  useEffect(() => {
    if (!open || healthCheckedRef.current) return
    healthCheckedRef.current = true
    fetch('/api/chat', { method: 'HEAD' })
      .then((r) => setAiOnline(r.ok))
      .catch(() => setAiOnline(false))
  }, [open])

  // 自动聚焦
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // 滚动到底
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streaming])

  // 关闭弹窗时停止流
  useEffect(() => {
    if (!open) abortRef.current?.abort()
  }, [open])

  async function ask() {
    const q = question.trim()
    if (!q || streaming) return
    setError(null)

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: q,
      createdAt: Date.now(),
    }
    // 乐观追加 user + 占位 assistant
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setQuestion('')
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: q }],
          useRag: true,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const t = await res.text()
        let msg = `请求失败 (${res.status})`
        try {
          msg = JSON.parse(t).error || msg
        } catch {}
        throw new Error(msg)
      }

      // 提取来源
      const srcH = res.headers.get('X-Context-Post-Titles')
      const sources = srcH
        ? (() => {
            try {
              return JSON.parse(decodeURIComponent(srcH)) as { title: string; url: string }[]
            } catch {
              return []
            }
          })()
        : []

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const t = line.trim()
          if (!t.startsWith('data:')) continue
          const payload = t.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const j = JSON.parse(payload)
            const delta = j.choices?.[0]?.delta?.content
            if (typeof delta === 'string') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: m.content + delta }
                    : m
                )
              )
            }
          } catch {}
        }
      }

      // 流结束：附加 sources
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, sources } : m))
      )
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // 用户主动停止：移除空的 assistant 消息
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id || m.content))
        return
      }
      setError(err.message || '未知错误')
      // 错误时移除空的 assistant，保留 user
      setMessages((prev) =>
        prev.filter((m) => m.id !== assistantMsg.id || m.content)
      )
    } finally {
      setStreaming(false)
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ask()
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  function reset() {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
  }

  return (
    <>
      {/* FAB - 右下角小气泡 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="AI 助手"
          title="问问 AI 助手"
          className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 hover:scale-105 transition-all flex items-center justify-center"
        >
          <Icon name="bot" size={20} />
        </button>
      )}

      {/* 小弹窗 - 右侧滑出 */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-3rem)] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden"
          role="dialog"
          aria-label="AI 助手"
        >
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-brand-50 to-white dark:from-brand-900/20 dark:to-gray-900">
            <div className="flex items-center gap-2">
              <Icon name="bot" size={18} className="text-brand-600" />
              <div>
                <h3 className="font-semibold text-sm">AI 助手</h3>
                <p className="text-[10px] text-gray-500">
                  基于博客内容回答
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={reset}
                  className="p-1.5 text-gray-500 hover:text-brand-600"
                  title="清空对话"
                >
                  <Icon name="refresh" size={16} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-gray-500 hover:text-red-600"
                title="关闭"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </header>

          {/* 状态条 */}
          <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 flex items-center gap-2">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                aiOnline === null
                  ? 'bg-gray-400'
                  : aiOnline
                    ? 'bg-green-500'
                    : 'bg-red-500'
              }`}
            />
            {aiOnline === null
              ? '检测中...'
              : aiOnline
                ? '博客索引就绪'
                : '未构建索引（仅关键词）'}
            <span className="mx-1">·</span>
            <span className="truncate">文章：{postTitle}</span>
          </div>

          {/* 对话区 */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {messages.length === 0 && !error && !streaming && (
              <EmptyState
                onPick={(q) => {
                  setQuestion(q)
                  setTimeout(ask, 50)
                }}
              />
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} streaming={streaming} />
            ))}

            {error && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-700 dark:text-red-300">
                <Icon name="alert-circle" size={12} className="inline-block mr-1" />
                {error}
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div className="border-t border-gray-200 dark:border-gray-200 p-2.5">
            <div className="flex gap-1.5">
              <textarea
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={onKey}
                placeholder="问点关于博客的问题..."
                rows={2}
                disabled={aiOnline === false}
                className="flex-1 resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
              />
              {streaming ? (
                <button
                  onClick={stop}
                  className="px-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600"
                  title="停止"
                >
                  <Icon name="stop" size={16} />
                </button>
              ) : (
                <button
                  onClick={ask}
                  disabled={!question.trim() || aiOnline === false}
                  className="px-2.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                  title="发送 (Enter)"
                >
                  <Icon name="send" size={16} />
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-1 text-center">
              Enter 发送 · Shift+Enter 换行
            </p>
          </div>
        </div>
      )}
    </>
  )
}

function MessageBubble({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-brand-600 text-white px-3 py-2 text-sm">
          {message.content}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="text-[10px] text-gray-500">💬 回答：</div>
      <div className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed prose prose-sm dark:prose-invert max-w-none">
        {message.content || (streaming ? '正在生成…' : '')}
        {streaming && message.content && (
          <span className="inline-block w-1.5 h-3.5 ml-0.5 align-text-bottom bg-brand-500 animate-pulse rounded-sm" />
        )}
      </div>
      {message.sources && message.sources.length > 0 && !streaming && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[10px] text-gray-500 mb-1.5">📚 参考：</p>
          <ul className="space-y-1">
            {message.sources.map((s, i) => (
              <li key={i} className="text-xs">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener"
                  className="text-brand-600 hover:underline line-clamp-1"
                >
                  → {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  const suggestions = [
    '这个博客用了什么技术？',
    '推荐几篇关于 Astro 的文章',
    '如何选择前端框架？',
  ]
  return (
    <div className="text-center py-6">
      <Icon name="bot" size={40} className="text-brand-600 mb-2 inline-block" />
      <p className="text-xs text-gray-500 mb-4">问我博客里写过的任何内容</p>
      <div className="space-y-1.5 text-left">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="w-full text-left text-xs px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
          >
            💡 {s}
          </button>
        ))}
      </div>
    </div>
  )
}
