---
title: 在 Astro 中使用 React 组件
description: Astro 默认零 JS，但你仍可以在需要交互的"岛屿"中使用 React。本文介绍 hydrate 指令的最佳实践。
date: 2026-06-18
tags:
  - react
  - astro
  - tutorial
---

# 在 Astro 中使用 React 组件

Astro 的核心理念是 **Islands Architecture**——页面默认是静态 HTML，只有标记为"岛屿"的组件会水合（hydrate）成交互式应用。

## 添加 React 支持

```bash
pnpm add -D @astrojs/react react react-dom
pnpm add @types/react @types/react-dom
```

```ts
// astro.config.mjs
import react from '@astrojs/react'
export default defineConfig({
  integrations: [react()],
})
```

## 编写 React 组件

```tsx
// src/components/Counter.tsx
import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button onClick={() => setCount((c) => c + 1)}>
      点击了 {count} 次
    </button>
  )
}
```

## 岛屿指令

在 Astro 页面中使用：

```astro
---
import Counter from '../components/Counter'
---

<!-- 立即加载，客户端立即水合 -->
<Counter client:load />

<!-- 浏览器空闲时水合（推荐） -->
<Counter client:idle />

<!-- 视口可见时水合 -->
<Counter client:visible />

<!-- 仅在媒体查询匹配时水合 -->
<Counter client:media="(max-width: 768px)" />

<!-- 完全不水合（不推荐，除非你确定不需要交互） -->
<Counter />
```

## 何时使用哪个指令？

| 指令 | 场景 |
| --- | --- |
| `client:load` | 首屏关键交互（搜索框、菜单） |
| `client:idle` | 优先级低的交互（点赞、分享） |
| `client:visible` | 折叠下方的内容（评论、推荐） |
| `client:media` | 移动端专属功能 |
| 无 client | 纯展示（无 JS） |

## 在 MDX 中使用

Astro 的 MDX 集成允许你直接在文章中写 React 组件：

```mdx
---
title: 我的文章
---

import Counter from '../../components/Counter'

# 演示

点击下面这个按钮：

<Counter client:visible />
```

## 性能小贴士

- 一个页面放 10 个 `client:load` 组件 = 10 个 bundle ❌
- 优先用 `client:visible` 或 `client:idle`
- 共享数据用 **Nano Stores** 而不是 Context（避免全树 hydrate）

## 小结

Astro 的 Islands 让你**只在需要的地方付费**——这是它比 Next.js / Nuxt 更轻量的核心原因。
