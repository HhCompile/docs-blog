import type { APIRoute } from 'astro'
import { readPost, writePost, softDelete } from '../../../../lib/post-store'

export const prerender = false

/** GET /admin/api/posts/[slug] — 读取单篇 */
export const GET: APIRoute = async ({ params }) => {
  const post = await readPost(params.slug || '')
  if (!post) return new Response('Not Found', { status: 404 })
  return new Response(JSON.stringify(post), {
    headers: { 'content-type': 'application/json' },
  })
}

/** PUT /admin/api/posts/[slug] — 更新文章 */
export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const body = await request.json()
    const meta = body.meta
    const content = (body.body || '').toString()
    if (!meta || typeof meta !== 'object') return new Response('meta 无效', { status: 400 })
    if (!meta.title) return new Response('标题不能为空', { status: 400 })
    const post = await writePost(params.slug || '', meta, content)
    return new Response(JSON.stringify(post), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(e.message || '保存失败', { status: 500 })
  }
}

/** DELETE /admin/api/posts/[slug] — 软删除 */
export const DELETE: APIRoute = async ({ params }) => {
  const ok = await softDelete(params.slug || '')
  if (!ok) return new Response('Not Found', { status: 404 })
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  })
}
