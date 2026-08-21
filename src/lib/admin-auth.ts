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

function getTotpSecret(): string | null {
  const s = process.env.ADMIN_TOTP_SECRET
  return s && s.trim().length >= 16 ? s.trim() : null
}

/**
 * TOTP (RFC 6238) 自实现：HMAC-SHA1 + 30s 步长 + 6 位码
 * 不依赖第三方库，避免 Node 版本兼容问题
 */
function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of input.toUpperCase().replace(/=+$/, '')) {
    const idx = alphabet.indexOf(c)
    if (idx < 0) throw new Error(`Invalid base32 char: ${c}`)
    bits += idx.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

function totpCode(secret: string, window = 0): string {
  const key = base32Decode(secret)
  const counter = Math.floor(Date.now() / 1000 / 30) + window
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24 |
      (hmac[offset + 1] << 16) |
      (hmac[offset + 2] << 8) |
      hmac[offset + 3]) % 1_000_000
  return String(code).padStart(6, '0')
}

/**
 * 校验用户输入的 TOTP 验证码（允许前后各 1 个时间窗口容差）
 * 未配置 ADMIN_TOTP_SECRET 时跳过校验（兼容仅密码登录）
 */
export function checkTotp(input: string | null | undefined): boolean {
  const secret = getTotpSecret()
  if (!secret) return true // 未启用 TOTP，视为通过
  if (!input || !/^\d{6}$/.test(input.trim())) return false
  const token = input.trim()
  return [-1, 0, 1].some((w) => timingSafeEqual(Buffer.from(totpCode(secret, w)), Buffer.from(token)))
}

export function isTotpEnabled(): boolean {
  return getTotpSecret() !== null
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
