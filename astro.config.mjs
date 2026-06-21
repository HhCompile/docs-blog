// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'

import siteConfig from './src/data/site.config.mjs'

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  site: siteConfig.site_url,
  trailingSlash: 'never',
  integrations: [
    react(),
    mdx(),
    sitemap({
      // 排除后台路由（不被搜索引擎索引）
      filter: (page) => !page.includes('/admin/') && !page.includes('/admin'),
    }),
  ],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: true,
    },
  },
  build: {
    format: 'directory',
  },
  server: {
    host: true,
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['pagefind'],
    },
    ssr: {
      noExternal: ['streamdown', 'cmdk', 'lucide-react'],
    },
  },
})
