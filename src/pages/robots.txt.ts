import type { APIRoute } from 'astro'
import siteConfig from '../data/site.config.mjs'

export const GET: APIRoute = () => {
  const body = `User-agent: *
Allow: /

Sitemap: ${siteConfig.site_url}/sitemap-index.xml
`
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
