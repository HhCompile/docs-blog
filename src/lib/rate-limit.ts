/**
 * 内存限流器（滑动窗口）
 * - 按 key（如 IP）限制单位时间内的请求数
 * - 仅进程内有效，多实例部署需改为 Redis 等共享存储
 * - 默认：60s 窗口最多 20 次
 */
export interface RateLimitOptions {
  /** 窗口长度（毫秒） */
  windowMs?: number
  /** 窗口内允许的最大次数 */
  max?: number
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

const buckets = new Map<string, number[]>()

/** 清理过期条目（避免内存泄漏） */
function gc(now: number, windowMs: number) {
  for (const [key, stamps] of buckets) {
    const fresh = stamps.filter((t) => now - t < windowMs)
    if (fresh.length === 0) buckets.delete(key)
    else if (fresh.length !== stamps.length) buckets.set(key, fresh)
  }
}

/** 校验是否超限，并记录本次请求 */
export function checkRate(
  key: string,
  opts: RateLimitOptions = {}
): RateLimitResult {
  const windowMs = opts.windowMs ?? 60_000
  const max = opts.max ?? 20
  const now = Date.now()

  // 每 100 次检查 GC 一次
  if (buckets.size > 0 && Math.random() < 0.01) gc(now, windowMs)

  const stamps = buckets.get(key) ?? []
  const fresh = stamps.filter((t) => now - t < windowMs)
  if (fresh.length >= max) {
    buckets.set(key, fresh)
    return {
      ok: false,
      remaining: 0,
      resetAt: fresh[0] + windowMs,
    }
  }
  fresh.push(now)
  buckets.set(key, fresh)
  return {
    ok: true,
    remaining: max - fresh.length,
    resetAt: now + windowMs,
  }
}

/** 清空所有限流状态（用于测试） */
export function _resetRateLimit() {
  buckets.clear()
}
