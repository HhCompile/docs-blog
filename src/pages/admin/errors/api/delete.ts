import type { APIRoute } from 'astro'
import { deleteError } from '../../../../lib/error-store'

export const prerender = false

// 鉴权由 src/middleware.ts 统一处理
export const DELETE: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id')
  if (!id) return new Response('id required', { status: 400 })
  const ok = await deleteError(id)
  return new Response(JSON.stringify({ ok }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
