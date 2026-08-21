import type { APIRoute } from 'astro'
import { listPosts, listTrash, createPost } from '../../../../lib/post-store'

export const prerender = false

/** GET /admin/api/posts — 文章列表（?trash=1 返回回收站） */
export const GET: APIRoute = async ({ url }) => {
  const posts = url.searchParams.get('trash') === '1' ? await listTrash() : await listPosts()
  return new Response(JSON.stringify(posts), {
    headers: { 'content-type': 'application/json' },
  })
}

/** POST /admin/api/posts — 新建文章 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const title = (body.title || '').toString().trim()
    if (!title) return new Response('标题不能为空', { status: 400 })
    const post = await createPost(title)
    return new Response(JSON.stringify(post), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(e.message || '创建失败', { status: 500 })
  }
}
