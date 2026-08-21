import type { APIRoute } from 'astro'
import { getThemeSettings, buildThemeCss } from '../../lib/theme-store'

/**
 * 实时主题 CSS 端点
 * - 前台页面均为 prerender（静态 HTML），无法在请求时注入主题
 * - 本端点每次请求实时读取 theme.json 生成 CSS，浏览器通过 <link> 引入
 * - Cache-Control: no-store 确保后台修改主题后立即生效
 */
export const GET: APIRoute = async () => {
  try {
    const theme = await getThemeSettings()
    const css = buildThemeCss(theme)
    return new Response(css, {
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return new Response('/* theme css error */', {
      status: 500,
      headers: { 'Content-Type': 'text/css; charset=utf-8' },
    })
  }
}
