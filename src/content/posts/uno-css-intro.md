---
title: UnoCSS 入门：原子化 CSS 的新选择
description: 介绍 UnoCSS 的核心概念、安装配置、与 Tailwind 的差异，以及在 Astro 中的最佳实践。
date: 2026-06-18
tags:
  - unocss
  - css
  - tutorial
---

# UnoCSS 入门：原子化 CSS 的新选择

[UnoCSS](https://unocss.dev) 是一个**即时按需**的原子化 CSS 引擎，由 Anthony Fu 开发。

## 核心特性

- ⚡ **极速** - 比 Tailwind JIT 快 5 倍
- 🎨 **灵活** - 预设、Attributify、纯 CSS 图标、Typography
- 🔌 **可扩展** - 自定义规则、shortcuts、变体
- 📦 **轻量** - 0 依赖，浏览器侧 < 30KB

## 安装

```bash
pnpm add -D unocss @unocss/astro
```

## 配置

```ts
// uno.config.ts
import { defineConfig, presetWind3, presetIcons, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [
    presetWind3(),         // Tailwind 兼容语法
    presetAttributify(),   // 属性化模式
    presetIcons({          // 纯 CSS 图标
      scale: 1.2,
    }),
  ],
})
```

在 Astro 中：

```ts
// astro.config.mjs
import UnoCSS from '@unocss/astro'
export default defineConfig({
  integrations: [UnoCSS({ injectReset: true })],
})
```

## 使用示例

```html
<!-- 工具类 -->
<button class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
  点击
</button>

<!-- Attributify 模式 -->
<button
  bg="blue-500 hover:blue-600"
  text="white"
  px="4" py="2" rounded
>
  点击
</button>

<!-- 纯 CSS 图标（无需 icon 组件） -->
<span class="i-mdi-github text-2xl"></span>
```

## 与 Tailwind 的差异

| 维度 | UnoCSS | Tailwind |
| --- | --- | --- |
| 引擎 | Vite 插件 | PostCSS 插件 |
| 速度 | 极快 | 快 |
| 图标 | 内置 200+ | 需额外库 |
| 体积 | 0 依赖 | 较大 |
| 学习曲线 | 略高 | 平缓 |

## 小结

UnoCSS 适合**追求极致性能和 DX** 的项目。如果是从 Tailwind 迁移，几乎 0 成本。
