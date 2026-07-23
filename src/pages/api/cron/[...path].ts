import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'

const BACKEND_URL = 'http://cron-admin:8000/api'

async function proxyRequest(request: Request, path: string): Promise<Response> {
  const url = new URL(request.url)
  const target = `${BACKEND_URL}${path}${url.search}`

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('connection')

  const init: RequestInit = {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.clone().text() : undefined,
  }

  const res = await fetch(target, init)
  const body = await res.arrayBuffer()
  const responseHeaders = new Headers(res.headers)
  responseHeaders.delete('content-encoding')

  return new Response(body, { status: res.status, headers: responseHeaders })
}

async function checkAuth(request: Request): Promise<Response | null> {
  const auth = isAuthenticated({ request, cookies: {
    get: (name: string) => {
      const cookie = request.headers.get('cookie')?.match(new RegExp(`\\b${name}=([^;]+)`))
      return cookie ? { value: decodeURIComponent(cookie[1]) } : undefined
    },
  } } as any)
  if (!auth) {
    return new Response('Unauthorized', { status: 401 })
  }
  return null
}

export const GET: APIRoute = async ({ request }) => {
  const denied = await checkAuth(request)
  if (denied) return denied
  return proxyRequest(request, request.url.replace(/^.*\/api\/cron/, ''))
}

export const POST: APIRoute = async ({ request }) => {
  const denied = await checkAuth(request)
  if (denied) return denied
  return proxyRequest(request, request.url.replace(/^.*\/api\/cron/, ''))
}

export const PUT: APIRoute = async ({ request }) => {
  const denied = await checkAuth(request)
  if (denied) return denied
  return proxyRequest(request, request.url.replace(/^.*\/api\/cron/, ''))
}

export const DELETE: APIRoute = async ({ request }) => {
  const denied = await checkAuth(request)
  if (denied) return denied
  return proxyRequest(request, request.url.replace(/^.*\/api\/cron/, ''))
}
