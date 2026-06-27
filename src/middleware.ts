/**
 * Astro 中间件
 * 职责：
 *  1. /admin 路径前缀鉴权（除 /admin/login 外都需登录）
 *  2. 注入安全响应头（CSP / X-Frame-Options 等）
 *  3. 捕获 API 路由 500 错误
 *  4. 资源 404 错误
 *  5. 页面渲染异常
 */
import { defineMiddleware } from 'astro:middleware'
import { isAuthenticated, SESSION_PATH } from './lib/admin-auth'
import { logError } from './lib/error-store'
import { getClientIp } from './lib/client-ip'

// 公开的 admin 路径（不需要鉴权）
const PUBLIC_ADMIN_PATHS = new Set([`${SESSION_PATH}/login`, `${SESSION_PATH}/logout`])

function isProtectedAdmin(pathname: string): boolean {
  if (!pathname.startsWith(SESSION_PATH)) return false
  return !PUBLIC_ADMIN_PATHS.has(pathname)
}

/** CSP 策略：限制 script/style/img/connect 源，允许 LM Studio 本地服务 */
/** Umami 域名从 env 注入（PUBLIC_UMAMI_URL），默认留 Umami Cloud */
const umamiHost = process.env.PUBLIC_UMAMI_URL
  ? new URL(process.env.PUBLIC_UMAMI_URL).origin
  : 'https://cloud.umami.is'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  // Umami + LM Studio + 自托管 umami
  `connect-src 'self' http://localhost:1234 ws://localhost:1234 https://*.umami.is ${umamiHost}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

/** 给响应注入安全头 */
function withSecurityHeaders(response: Response): Response {
  // 不能修改 immutable 头（astro 在某些情况下返回的 response 是 immutable）
  try {
    response.headers.set('Content-Security-Policy', CSP)
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  } catch {
    // immutable headers: 静默跳过
  }
  return response
}

export const onRequest = defineMiddleware(async (context, next) => {
  // 1. /admin 鉴权
  if (isProtectedAdmin(context.url.pathname)) {
    if (!isAuthenticated(context)) {
      const isApiOrAsset =
        context.url.pathname.startsWith(`${SESSION_PATH}/api/`) ||
        context.url.pathname.startsWith(`${SESSION_PATH}/static/`)
      if (isApiOrAsset) {
        return new Response('Unauthorized', { status: 401 })
      }
      const redirect = encodeURIComponent(context.url.pathname + context.url.search)
      return context.redirect(`/admin/login?redirect=${redirect}`, 302)
    }
  }

  // 2. 错误捕获 + 资源 404 + 安全头注入
  try {
    const response = await next()

    if (response.status === 404 && context.url.pathname !== '/404') {
      const skip =
        context.url.pathname.startsWith('/favicon') ||
        context.url.pathname.startsWith('/_astro/') ||
        context.url.pathname.startsWith('/pagefind/') ||
        context.url.pathname.startsWith('/search-index.json')
      if (!skip) {
        await logError({
          level: 'resource',
          message: `404 ${context.url.pathname}`,
          url: context.url.pathname,
          status: 404,
          ip: getClientIp(context.request, context.clientAddress),
          userAgent: context.request.headers.get('user-agent') ?? undefined,
        })
      }
    }

    return withSecurityHeaders(response)
  } catch (err: any) {
    await logError({
      level: 'server',
      message: err.message || 'Server error',
      stack: err.stack,
      url: context.url.pathname,
      type: err.name,
      status: 500,
      ip: getClientIp(context.request, context.clientAddress),
      userAgent: context.request.headers.get('user-agent') ?? undefined,
    })
    return withSecurityHeaders(new Response('Internal Server Error', { status: 500 }))
  }
})
