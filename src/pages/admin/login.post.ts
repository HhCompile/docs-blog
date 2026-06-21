import type { APIRoute } from 'astro'
import { checkPassword, setSessionCookie } from '../../lib/admin-auth'

export const prerender = false

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData()
  const pwd = form.get('password')?.toString()
  const redirectTo = form.get('redirect')?.toString() || '/admin/errors'

  if (!checkPassword(pwd)) {
    return redirect(`/admin/login?error=invalid&redirect=${encodeURIComponent(redirectTo)}`, 303)
  }

  setSessionCookie({ cookies } as any)
  return redirect(redirectTo, 303)
}
