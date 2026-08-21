import type { APIRoute } from 'astro'
import { getThemeSettings, saveThemeSettings } from '../../../lib/theme-store'

export const prerender = false

/** GET /admin/api/settings — 读取主题设置 */
export const GET: APIRoute = async () => {
  const settings = await getThemeSettings()
  return new Response(JSON.stringify(settings), {
    headers: { 'content-type': 'application/json' },
  })
}

/** PUT /admin/api/settings — 保存主题设置 */
export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const settings = await saveThemeSettings({
      preset: body.preset || 'default',
      customCss: body.customCss || '',
    })
    return new Response(JSON.stringify(settings), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(e.message || '保存失败', { status: 500 })
  }
}
