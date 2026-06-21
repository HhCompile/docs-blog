/**
 * AI 摘要运行时 API
 *
 * GET /api/summarize?slug=xxx
 *
 * 策略（双保险）:
 *  1. 优先读构建时缓存 .cache/summaries.json
 *  2. 缓存 miss 时调 LLM 实时生成 + 写回缓存
 *  3. LLM 不可用时返回 null（前端显示空状态）
 *
 * POST /api/summarize  body: { slug, content, title }   强制重新生成
 */
import type { APIRoute } from 'astro'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { checkRate } from '../../lib/rate-limit'

interface SummaryEntry {
  summary: string
  generatedAt: string
  model: string
}

type SummaryCache = Record<string, SummaryEntry>

import { llmConfig, lmFetch } from '../../lib/lmstudio'

const MODEL = llmConfig.model
const MAX_CHARS = Number(process.env.SUMMARY_MAX_CHARS || 200)

// 输入上限（防 DoS + 节省 LLM 算力）
const MAX_CONTENT_LENGTH = 20_000
// slug / title 上限
const MAX_META_LENGTH = 200

// 内存缓存（避免每次读盘）
let cache: SummaryCache | null = null
let cacheLoadTime = 0
const TTL = 60 * 1000

async function getCacheFile(): Promise<string> {
  // 开发模式：项目根；生产：dist/ 同级
  return path.resolve(process.cwd(), '.cache/summaries.json')
}

async function loadCache(): Promise<SummaryCache> {
  const now = Date.now()
  if (cache && now - cacheLoadTime < TTL) return cache
  try {
    const file = await getCacheFile()
    const raw = await fs.readFile(file, 'utf-8')
    cache = JSON.parse(raw)
    cacheLoadTime = now
  } catch {
    cache = {}
  }
  return cache!
}

async function saveCache(data: SummaryCache) {
  cache = data
  cacheLoadTime = Date.now()
  try {
    const file = await getCacheFile()
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(data, null, 2))
  } catch (err) {
    console.warn('[summarize] 写缓存失败:', err)
  }
}

function stripMarkdown(md: string): string {
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

async function callLLM(title: string, content: string): Promise<string> {
  const system = `你是一个博客摘要生成助手。请用${MAX_CHARS}字以内的中文总结文章核心内容，要求：
1. 一段话，不分点
2. 突出文章解决的问题、关键技术点、结论
3. 避免废话和重复
4. 不要使用"本文"、"作者"等冗余主语
5. 总结末尾不要写句号`

  const res = await lmFetch(llmConfig, '/chat/completions', {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `标题：${title}\n\n正文：\n${content.slice(0, 3000)}` },
    ],
    temperature: 0.3,
    max_tokens: 512,
    stream: false,
  })

  if (!res.ok) throw new Error(`LLM ${res.status}`)
  const json = await res.json()
  return json.choices?.[0]?.message?.content?.trim() ?? ''
}

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug')
  if (!slug) {
    return new Response('slug required', { status: 400 })
  }

  const c = await loadCache()
  if (c[slug]) {
    return new Response(
      JSON.stringify({ slug, source: 'cache', ...c[slug] }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ slug, source: 'miss', summary: null }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // 限流：每 IP 60s 最多 5 次（摘要更重）
  const limit = checkRate(`summarize:${clientAddress}`, { windowMs: 60_000, max: 5 })
  if (!limit.ok) {
    return new Response(
      JSON.stringify({ error: '请求过于频繁，请稍后再试' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
        },
      }
    )
  }

  let body: { slug?: string; title?: string; content?: string }
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  const { slug, title, content } = body
  if (!slug || !title || !content) {
    return new Response('slug / title / content required', { status: 400 })
  }
  // meta 字段上限
  if (slug.length > MAX_META_LENGTH || title.length > MAX_META_LENGTH) {
    return new Response(
      JSON.stringify({ error: 'slug/title 过长' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    )
  }
  // content 上限
  if (content.length > MAX_CONTENT_LENGTH) {
    return new Response(
      JSON.stringify({ error: `content ${content.length} 字符超过上限 ${MAX_CONTENT_LENGTH}` }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const text = stripMarkdown(content)
  if (text.length < 50) {
    return new Response(
      JSON.stringify({ error: '内容过短' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const summary = await callLLM(title, text)
    if (!summary) throw new Error('LLM 返回空')

    const c = await loadCache()
    c[slug] = {
      summary,
      generatedAt: new Date().toISOString(),
      model: MODEL,
    }
    await saveCache(c)

    return new Response(
      JSON.stringify({ slug, source: 'generated', summary, generatedAt: c[slug].generatedAt }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
