import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'zod'
import tagsData from './data/tags.json'

// 单一真源：tags.json
const VALID_TAG_IDS = (tagsData as { id: string }[]).map((t) => t.id)

if (VALID_TAG_IDS.length === 0) {
  throw new Error('content.config.ts: src/data/tags.json 为空，无法校验 tag 引用')
}

// 博客文章集合
const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional().default(''),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      // 标签 ID 列表（必须是 src/data/tags.json 中已定义的 id）
      tags: z
        .array(z.enum(VALID_TAG_IDS as [string, ...string[]]))
        .optional()
        .default([]),
      // 封面图（可选）
      cover: image().optional(),
      coverAlt: z.string().optional().default(''),
      // 是否为草稿（草稿不会出现在生产构建中）
      draft: z.boolean().optional().default(false),
      // 是否发布到外部平台
      publish: z
        .object({
          csdn: z.boolean().optional().default(false),
          juejin: z.boolean().optional().default(false),
        })
        .optional()
        .default({ csdn: false, juejin: false }),
    }),
})

export const collections = { posts }
