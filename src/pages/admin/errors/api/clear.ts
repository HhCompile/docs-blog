import type { APIRoute } from 'astro'
import { clearAll } from '../../../../lib/error-store'

export const prerender = false

// 鉴权由 src/middleware.ts 统一处理（/admin/api/* 路径已自动校验）
export const POST: APIRoute = async () => {
  await clearAll()
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
