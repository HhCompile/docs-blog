import type { APIRoute } from 'astro'
import { readPost, restorePost, hardDelete, publish } from '../../../../../lib/post-store'

export const prerender = false

/** GET /admin/api/posts/[slug]/manage — 回收站操作：restore / delete */
export const POST: APIRoute = async ({ params, request }) => {
  try {
    const body = await request.json()
    const action = body.action
    const slug = params.slug || ''

    if (action === 'restore') {
      const ok = await restorePost(slug)
      if (!ok) return new Response('恢复失败', { status: 404 })
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
    }
    if (action === 'delete') {
      const ok = await hardDelete(slug)
      if (!ok) return new Response('删除失败', { status: 404 })
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
    }
    return new Response('未知操作', { status: 400 })
  } catch (e: any) {
    return new Response(e.message || '操作失败', { status: 500 })
  }
}
