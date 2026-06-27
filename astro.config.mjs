// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import compress from 'astro-compress'
import remarkGfm from 'remark-gfm'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'

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
    compress(),
  ],
  markdown: {
    // 禁用默认 Shiki 让 rehype-pretty-code 接管
    syntaxHighlight: false,
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      [rehypeAutolinkHeadings, { behavior: 'append' }],
      [
        rehypePrettyCode,
        {
          theme: { light: 'github-light', dark: 'github-dark' },
          keepBackground: false,
        },
      ],
    ],
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
