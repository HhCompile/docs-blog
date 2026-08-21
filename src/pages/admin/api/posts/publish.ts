import type { APIRoute } from 'astro'
import { publish } from '../../../../lib/post-store'

export const prerender = false

/** POST /admin/api/posts/publish — 发布所有待发布内容（git push + build + restart） */
export const POST: APIRoute = async () => {
  const result = await publish()
  return new Response(
    JSON.stringify(result),
    { status: result.ok ? 200 : 500, headers: { 'content-type': 'application/json' } }
  )
}
