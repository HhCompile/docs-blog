#!/usr/bin/env node
/**
 * 构建时生成 Orama 全文搜索索引
 *
 * 流程：
 *   1. 读 src/content/posts/*.{md,mdx}
 *   2. 提取 front matter + 正文（剥离 markdown 语法）
 *   3. 调 @orama/orama 创建索引（schema: title/description/tags/content）
 *   4. save → 写入 dist/client/search-index.json
 *
 * 用法：pnpm search:build
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import matter from 'gray-matter'
import { create, insertMultiple, save } from '@orama/orama'

const ROOT = path.resolve(process.cwd(), 'src/content/posts')
const OUT = path.resolve(process.cwd(), 'dist/client/search-index.json')

// 复用项目内的标签元数据（用于 id → 名称映射）
const TAGS_FILE = path.resolve(process.cwd(), 'src/data/tags.json')

function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function listMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const out = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await listMarkdownFiles(full)))
    else if (/\.(md|mdx)$/.test(e.name) && !e.name.startsWith('_')) out.push(full)
  }
  return out
}

async function loadTagsMap() {
  try {
    const raw = await fs.readFile(TAGS_FILE, 'utf-8')
    const arr = JSON.parse(raw)
    return new Map(arr.map((t) => [t.id, t.name]))
  } catch {
    return new Map()
  }
}

async function main() {
  const tagMap = await loadTagsMap()
  const files = await listMarkdownFiles(ROOT)
  console.log(`📚 扫描到 ${files.length} 篇文章`)

  const records = []
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf-8')
    const { data: fm, content } = matter(raw)
    if (fm.draft) continue
    const slug = path.basename(file, path.extname(file))
    const tagIds = fm.tags || []
    const tagNames = tagIds.map((id) => tagMap.get(id) || id).join(' ')

    records.push({
      id: slug,
      title: fm.title || slug,
      description: fm.description || '',
      date: fm.date ? new Date(fm.date).toISOString().slice(0, 10) : '',
      tags: tagNames, // 加权搜索：标签名也参与匹配
      tagIds, // 原始 ID 列表，供前端展示
      content: stripMarkdown(content),
      url: `/posts/${slug}`,
    })
  }

  if (records.length === 0) {
    console.warn('⚠️  无可用文章，跳过索引生成')
    return
  }

  // 创建 Orama DB（Orama 3.x 中 create/save 均为同步）
  const db = create({
    schema: {
      id: 'string',
      title: 'string',
      description: 'string',
      date: 'string',
      tags: 'string',
      tagIds: 'string[]',
      content: 'string',
      url: 'string',
    },
  })

  await insertMultiple(db, records)
  console.log(`🔍 已索引 ${records.length} 篇文章`)

  // 持久化为 JSON
  const data = save(db)
  await fs.mkdir(path.dirname(OUT), { recursive: true })
  await fs.writeFile(OUT, data)
  const sizeKB = (Buffer.byteLength(data) / 1024).toFixed(1)
  console.log(`✅ 索引已写入: ${OUT} (${sizeKB} KB)`)
  console.log('💡 dev 模式下需先运行 pnpm build 才能使用搜索')
}

main().catch((err) => {
  console.error('💥 异常:', err)
  process.exit(1)
})
