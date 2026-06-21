/**
 * Admin 鉴权
 * - 用 .env 的 ADMIN_PASSWORD 验证密码
 * - 通过后用 ADMIN_SECRET 签发 HMAC-SHA256 token，写入 HttpOnly cookie
 * - 必须同时配置 ADMIN_PASSWORD 和 ADMIN_SECRET，否则拒绝访问（fail-secure）
 * - 验证采用恒定时间比较，防止计时攻击
 */
import type { APIContext } from 'astro'
import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'admin_session'
const SESSION_DAYS = 7
const TOKEN_PREFIX = 'v2.'

function getPassword(): string | null {
  const pwd = process.env.ADMIN_PASSWORD
  return pwd && pwd.length >= 4 ? pwd : null
}

function getSecret(): string | null {
  const s = process.env.ADMIN_SECRET
  return s && s.length >= 16 ? s : null
}

function sign(payload: string): string {
  const secret = getSecret()
  if (!secret) throw new Error('ADMIN_SECRET 未配置')
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function generateToken(): string {
  const issuedAt = Date.now()
  const payload = `${issuedAt}`
  const sig = sign(payload)
  return `${TOKEN_PREFIX}${payload}.${sig}`
}

function isValidToken(token: string | undefined): boolean {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return false
  const rest = token.slice(TOKEN_PREFIX.length)
  const [ts, sig] = rest.split('.')
  if (!ts || !sig) return false

  // 验签（必须先有 secret 才能验证）
  const secret = getSecret()
  if (!secret) return false
  const expected = sign(ts)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  if (!timingSafeEqual(a, b)) return false

  // 验过期
  const issuedAt = Number(ts)
  if (!Number.isFinite(issuedAt)) return false
  return Date.now() - issuedAt < SESSION_DAYS * 24 * 60 * 60 * 1000
}

export function isAdminConfigured(): boolean {
  return getPassword() !== null && getSecret() !== null
}

export function checkPassword(input: string | null | undefined): boolean {
  const pwd = getPassword()
  if (!pwd) return false
  if (!input) return false
  // 常数时间比较（防计时攻击）
  if (input.length !== pwd.length) return false
  const a = Buffer.from(input)
  const b = Buffer.from(pwd)
  return timingSafeEqual(a, b)
}

export function isAuthenticated(context: APIContext): boolean {
  if (!isAdminConfigured()) return false
  const cookie = context.cookies.get(COOKIE_NAME)
  return isValidToken(cookie?.value)
}

export function setSessionCookie(context: APIContext) {
  if (!isAdminConfigured()) return
  const token = generateToken()
  context.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: SESSION_PATH,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export function clearSessionCookie(context: APIContext) {
  context.cookies.delete(COOKIE_NAME, { path: SESSION_PATH })
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME
export const SESSION_PATH = '/admin'
