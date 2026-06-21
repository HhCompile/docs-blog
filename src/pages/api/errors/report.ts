/**
 * 客户端错误上报 API
 * POST /api/errors/report
 * Body: { message, stack?, url?, type?, context? }
 */
import type { APIRoute } from 'astro'
import { logError } from '../../../lib/error-store'
import { getClientIp } from '../../../lib/client-ip'

export const prerender = false

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: any
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { message, stack, url, type, context } = body ?? {}

  if (!message || typeof message !== 'string') {
    return new Response('message required', { status: 400 })
  }
  if (message.length > 2000) {
    return new Response('message too long', { status: 400 })
  }

  await logError({
    level: 'client',
    message: message.slice(0, 500),
    stack: stack?.slice(0, 4000),
    url: typeof url === 'string' ? url.slice(0, 500) : undefined,
    type: typeof type === 'string' ? type.slice(0, 100) : undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
    ip: getClientIp(request, clientAddress),
    context: context && typeof context === 'object' ? context : undefined,
  })

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
