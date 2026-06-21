---
title: 为什么选择 Astro 构建博客
description: 从 SEO、性能、DX 三方面对比主流博客框架，最终选择 Astro 的核心理由。
date: 2026-06-18
tags:
  - astro
  - seo
  - frontend
---

# 为什么选择 Astro 构建博客

我从 2024 年开始认真写博客，前前后后用过 Hexo、VuePress、VitePress，最终迁移到了 **Astro**。这篇文章记录下决策过程。

## SEO 友好度对比

| 框架 | SSG/SSR | sitemap | RSS | JSON-LD | 评分 |
| --- | --- | --- | --- | --- | --- |
| Astro | ✅ | 自动 | 自动 | 手写简单 | ⭐⭐⭐⭐⭐ |
| Next.js | ✅ | 插件 | 插件 | 插件 | ⭐⭐⭐⭐ |
| Nuxt | ✅ | 插件 | 插件 | 插件 | ⭐⭐⭐⭐ |
| VitePress | ✅ | 插件 | 插件 | 手写 | ⭐⭐⭐ |

Astro 的优势在于**默认就支持静态化、零 JS 输出**，搜索引擎抓取的是干净的 HTML。

## 性能

Astro 默认不向浏览器发送任何 JavaScript。"Islands Architecture"（群岛架构）允许你按需把交互组件（React/Vue/Svelte）水合到页面上。

> 一个普通博客文章页面：0 KB JS，首屏 < 100ms

## 写作体验

- 纯 Markdown，Front Matter 校验（Zod schema）
- 支持 MDX，可在文章里直接写 React 组件
- 内置代码高亮（Shiki）、数学公式、LaTeX

## 部署

```bash
# 一行命令部署到 Vercel/Netlify/Cloudflare Pages
pnpm build && pnpm dlx vercel deploy --prod
```

或上传 `dist/` 目录到任何静态托管服务（GitHub Pages、COS、OSS）。

## 小结

如果你也在选博客框架，**Astro 是 2025 年的最优解**——SEO 拉满、性能极致、写作体验一流。
