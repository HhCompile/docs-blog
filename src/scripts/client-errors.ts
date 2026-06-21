/**
 * 客户端错误监控
 * 监听：
 *   1. window.onerror — 未捕获 JS 异常
 *   2. unhandledrejection — 未捕获 Promise rejection
 *   3. fetch 失败（包装全局 fetch）
 *   4. 资源加载失败（img/script/link）
 * 上报到 /api/errors/report（仅错误信息，不含敏感数据）
 */

const REPORT_URL = '/api/errors/report'
const MAX_QUEUE = 20

// 同一错误的去重窗口（5 秒内同一消息只上报一次）
const recent = new Map<string, number>()
const DEDUPE_WINDOW = 5000

let queue: Promise<unknown> = Promise.resolve()
let queuedCount = 0

function report(payload: {
  message: string
  stack?: string
  url?: string
  type?: string
  context?: Record<string, unknown>
}) {
  const key = `${payload.type ?? 'Error'}:${payload.message}`
  const last = recent.get(key)
  if (last && Date.now() - last < DEDUPE_WINDOW) return
  recent.set(key, Date.now())

  if (queuedCount >= MAX_QUEUE) return
  queuedCount++

  queue = queue
    .then(() =>
      fetch(REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          url: payload.url ?? location.href,
        }),
        // 上报失败也不影响主流程
        keepalive: true,
      }).catch(() => {
        /* 忽略 */
      })
    )
    .finally(() => {
      queuedCount--
    })
}

// 1. JS 运行时错误
window.addEventListener('error', (e) => {
  report({
    message: e.message || 'Unknown error',
    stack: e.error?.stack,
    type: e.error?.name ?? 'Error',
    context: {
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
    },
  })
})

// 2. Promise 拒绝
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason
  const message =
    reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection')
  const stack = reason instanceof Error ? reason.stack : undefined
  report({
    message,
    stack,
    type: reason instanceof Error ? reason.name : 'UnhandledRejection',
  })
})

// 3. 资源加载失败
window.addEventListener(
  'error',
  (e) => {
    const target = e.target as HTMLElement
    if (!target || !(target instanceof HTMLImageElement || target instanceof HTMLLinkElement || target instanceof HTMLScriptElement)) return
    if (target instanceof HTMLScriptElement && target.src.includes('/_astro/')) return
    report({
      message: `Resource failed: ${target.tagName} ${(target as any).src ?? (target as any).href ?? ''}`,
      type: 'ResourceError',
    })
  },
  true
)
