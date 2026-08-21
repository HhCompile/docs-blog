import type { APIRoute } from 'astro'
import { checkPassword, checkTotp, setSessionCookie } from '../../lib/admin-auth'

export const prerender = false

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData()
  const pwd = form.get('password')?.toString()
  const totp = form.get('totp')?.toString()
  const redirectTo = form.get('redirect')?.toString() || '/admin/errors'

  // 密码校验（临时注释，仅用 TOTP 登录；需要时取消注释恢复双因子）
  // if (!checkPassword(pwd)) {
  //   return redirect(`/admin/login?error=invalid&redirect=${encodeURIComponent(redirectTo)}`, 303)
  // }

  // TOTP 二次验证（未配置 ADMIN_TOTP_SECRET 时自动跳过）
  if (!checkTotp(totp)) {
    return redirect(`/admin/login?error=totp&redirect=${encodeURIComponent(redirectTo)}`, 303)
  }

  setSessionCookie({ cookies } as any)
  return redirect(redirectTo, 303)
}
