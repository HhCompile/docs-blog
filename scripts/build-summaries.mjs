#!/usr/bin/env node
/**
 * 构建时为每篇文章生成 AI 摘要
 *
 * 输出: .cache/summaries.json
 *   {
 *     "post-slug": {
 *       "summary": "...",
 *       "generatedAt": "...",
 *       "model": "..."
 *     }
 *   }
 *
 * 配置 (.env):
 *   LMSTUDIO_BASE_URL    LLM 服务地址
 *   LMSTUDIO_MODEL       LLM 模型名
 *   LMSTUDIO_API_KEY     鉴权
 *   SUMMARY_MAX_CHARS    摘要字数（默认 200）
 *   SUMMARY_FORCE        true = 强制重新生成（忽略已有缓存）
 *
 * 用法:
 *   pnpm summaries          # 只生成缺失的
 *   SUMMARY_FORCE=true pnpm summaries  # 重新生成全部
 */

import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import matter from 'gray-matter'

const ROOT = path.resolve(process.cwd(), 'src/content/posts')
const CACHE = path.resolve(process.cwd(), '.cache/summaries.json')

const BASE_URL = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'
const API_KEY = process.env.LMSTUDIO_API_KEY || 'lm-studio'
const MODEL = process.env.LMSTUDIO_MODEL || 'local-model'
const MAX_CHARS = Number(process.env.SUMMARY_MAX_CHARS || 200)
const FORCE = process.env.SUMMARY_FORCE === 'true'

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

async function loadCache() {
  try {
    const raw = await fs.readFile(CACHE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function saveCache(cache) {
  await fs.mkdir(path.dirname(CACHE), { recursive: true })
  await fs.writeFile(CACHE, JSON.stringify(cache, null, 2))
}

async function generateSummary(title, content) {
  // 截断到 ~3000 字避免超 token
  const truncated = content.slice(0, 3000)
  const system = `你是一个博客摘要生成助手。请用${MAX_CHARS}字以内的中文总结文章核心内容，要求：
1. 一段话，不分点
2. 突出文章解决的问题、关键技术点、结论
3. 避免废话和重复
4. 不要使用"本文"、"作者"等冗余主语
5. 总结末尾不要写句号`

  const url = `${BASE_URL.replace(/\/+$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `标题：${title}\n\n正文：\n${truncated}` },
      ],
      temperature: 0.3,
      max_tokens: 512,
      stream: false,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json()
  return json.choices?.[0]?.message?.content?.trim() ?? ''
}

async function main() {
  const files = await listMarkdownFiles(ROOT)
  const cache = FORCE ? {} : await loadCache()

  console.log(`📚 ${files.length} 篇文章，缓存 ${Object.keys(cache).length} 篇`)

  // 测试连接
  try {
    const r = await fetch(`${BASE_URL.replace(/\/+$/, '')}/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
  } catch (err) {
    console.error('❌ 无法连接 LLM 服务:', err.message)
    console.error(`   ${BASE_URL} 不可达，将跳过摘要生成`)
    console.error('   提示：先启动 LM Studio 或设置 SUMMARY_FORCE=false 让构建继续')
    process.exit(0) // 不阻塞构建
  }

  let generated = 0
  let skipped = 0
  let failed = 0

  for (const file of files) {
    const slug = path.basename(file, path.extname(file))
    if (cache[slug] && !FORCE) {
      skipped++
      continue
    }

    const raw = await fs.readFile(file, 'utf-8')
    const { data: fm, content } = matter(raw)
    if (fm.draft) continue

    const title = fm.title || slug
    const text = stripMarkdown(content)
    if (text.length < 50) {
      console.log(`⏭  ${title} (内容过短，跳过)`)
      continue
    }

    process.stdout.write(`🤖 ${title} ... `)
    try {
      const summary = await generateSummary(title, text)
      if (!summary) throw new Error('空响应')
      cache[slug] = {
        summary,
        generatedAt: new Date().toISOString(),
        model: MODEL,
      }
      console.log(`✓ (${summary.length} 字)`)
      generated++
    } catch (err) {
      console.log(`✗ ${err.message}`)
      failed++
    }
  }

  await saveCache(cache)

  console.log(`\n✅ 生成 ${generated} 篇，跳过 ${skipped} 篇，失败 ${failed} 篇`)
  if (failed > 0) {
    console.warn('⚠️  部分摘要失败，但构建会继续（运行时可补）')
  }
  console.log(`📁 缓存: ${CACHE}`)
}

main().catch((err) => {
  console.error('💥 异常:', err)
  process.exit(0) // 不阻塞构建
})
