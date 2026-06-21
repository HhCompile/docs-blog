import type { APIRoute } from 'astro'
import { clearSessionCookie } from '../../lib/admin-auth'

export const prerender = false

export const GET: APIRoute = async ({ cookies, redirect }) => {
  clearSessionCookie({ cookies } as any)
  return redirect('/admin/login', 303)
}
