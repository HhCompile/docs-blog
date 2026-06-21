/**
 * AI 问答流式接口（向量检索版）
 *
 * POST /api/chat
 * Body: { messages: { role, content }[], useRag?: boolean }
 *
 * 检索流程:
 *  1. 加载 dist/client/blog-embeddings.json（构建时生成）
 *  2. 用 LM Studio /v1/embeddings 把用户问题向量化
 *  3. 余弦相似度排序 → top-K
 *  4. 注入 system prompt → 流式调用 LM Studio LLM
 *
 * 降级: embedding 服务不可用时回退到关键词重合度
 *
 * 配置环境变量:
 *   LMSTUDIO_BASE_URL    默认 http://localhost:1234/v1
 *   LMSTUDIO_MODEL       LLM 模型名
 *   EMBEDDING_MODEL      embedding 模型名（与 build-embeddings.mjs 保持一致）
 *   LMSTUDIO_API_KEY     默认 'lm-studio'
 *   RAG_TOP_K            默认 4
 *   RAG_MIN_SCORE        余弦相似度阈值，默认 0.3
 */
import type { APIRoute } from 'astro'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { checkRate } from '../../lib/rate-limit'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: Message[]
  useRag?: boolean
  model?: string
  temperature?: number
}

interface EmbeddingItem {
  id: string
  postId: string
  postTitle: string
  postUrl: string
  tags: string[]
  text: string
  vector: number[]
}

interface EmbeddingIndex {
  generatedAt: string
  model: string
  dimension: number
  totalChunks: number
  items: EmbeddingItem[]
}

import { llmConfig, embeddingConfig, lmFetch, lmGet } from '../../lib/lmstudio'

const BASE_URL = llmConfig.baseUrl
const DEFAULT_MODEL = llmConfig.model

// Embedding 服务（默认与 LLM 同地址，可独立配置到远程电脑）
const EMBEDDING_BASE_URL = embeddingConfig.baseUrl
const EMBEDDING_API_KEY = embeddingConfig.apiKey
const EMBEDDING_MODEL = embeddingConfig.model

const TOP_K = Number(process.env.RAG_TOP_K || 4)
const MIN_SCORE = Number(process.env.RAG_MIN_SCORE || 0.3)

// 输入限制（防 DoS）
const MAX_MESSAGES = 50
const MAX_CONTENT_PER_MESSAGE = 8000 // 约 2000 token
const MAX_TOTAL_CONTENT = 32000 // 全部消息累计上限

/* ───── 索引加载（带内存缓存） ───── */

let indexCache: EmbeddingIndex | null = null
let indexLoadTime = 0
const INDEX_TTL_MS = 5 * 60 * 1000 // 5 分钟

async function loadIndex(): Promise<EmbeddingIndex | null> {
  const now = Date.now()
  if (indexCache && now - indexLoadTime < INDEX_TTL_MS) return indexCache

  // 优先从项目根目录找（开发模式），再 dist/client（生产模式）
  const candidates = [
    path.resolve(process.cwd(), 'dist/client/blog-embeddings.json'),
    path.resolve(process.cwd(), 'blog-embeddings.json'),
  ]

  for (const file of candidates) {
    try {
      const raw = await fs.readFile(file, 'utf-8')
      const data = JSON.parse(raw) as EmbeddingIndex
      indexCache = data
      indexLoadTime = now
      return data
    } catch {
      /* 试下一个路径 */
    }
  }
  return null
}

/* ───── 余弦相似度（向量化） ───── */

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    dot += x * y
    na += x * x
    nb += y * y
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

/* ───── 关键词打分（降级用） ───── */

function keywordScore(query: string, text: string): number {
  const tokens = new Set<string>()
  const cn = query.match(/[一-龥]{2,}/g) || []
  const en = query.toLowerCase().match(/[a-z]{3,}/g) || []
  cn.forEach((t) => tokens.add(t))
  en.forEach((t) => tokens.add(t))
  if (tokens.size === 0) return 0
  const lower = text.toLowerCase()
  let hits = 0
  for (const t of tokens) if (lower.includes(t.toLowerCase())) hits++
  return hits / tokens.size
}

/* ───── LM Studio API 封装 ───── */

async function lmEmbed(text: string): Promise<number[] | null> {
  if (!EMBEDDING_MODEL) return null
  try {
    const res = await lmFetch(
      { baseUrl: EMBEDDING_BASE_URL, apiKey: EMBEDDING_API_KEY, model: EMBEDDING_MODEL },
      '/embeddings',
      { input: text.slice(0, 1500), model: EMBEDDING_MODEL }
    )
    if (!res.ok) {
      return null
    }
    const json = await res.json()
    return json.data?.[0]?.embedding ?? null
  } catch {
    return null
  }
}

/* ───── 检索 ───── */

interface RetrievedChunk {
  id: string
  postTitle: string
  postUrl: string
  text: string
  score: number
}

async function retrieveContext(query: string): Promise<RetrievedChunk[]> {
  const index = await loadIndex()
  if (!index || index.items.length === 0) {
    return []
  }

  // 1. 优先：向量检索
  const queryVec = await lmEmbed(query)
  if (queryVec) {
    const scored = index.items
      .map((it) => ({ ...it, score: cosine(queryVec, it.vector) }))
      .filter((x) => x.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K)
    return scored
  }

  // 2. 降级：关键词
  return index.items
    .map((it) => ({
      id: it.id,
      postTitle: it.postTitle,
      postUrl: it.postUrl,
      text: it.text,
      score: keywordScore(query, it.text),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
}

/* ───── Prompt 构建 ───── */

function buildSystemPrompt(context: RetrievedChunk[]): string {
  const base = `你是作者的博客 AI 助手，名字叫"小博"。请基于以下博客内容片段回答用户问题。

规则:
1. 优先引用提供的博客内容作答
2. 回答末尾列出参考的文章标题和链接（用 Markdown 列表）
3. 如果博客内容与问题无关，告知用户"这个问题博客里没写过"
4. 回答简洁，避免废话
5. 可以用 Markdown 格式（代码块/列表/表格均可）

`
  if (context.length === 0) {
    return base + '\n（暂无相关文章）\n'
  }
  const ctxText = context
    .map((c, i) => `【片段 ${i + 1}】来源: ${c.postTitle} (${c.postUrl}) [相似度 ${c.score.toFixed(3)}]\n${c.text}`)
    .join('\n\n---\n\n')
  return base + '\n' + ctxText + '\n'
}

/* ───── 路由处理 ───── */

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // 限流：每 IP 60s 最多 20 次（防 DoS + 节省 LM Studio 算力）
  const limit = checkRate(`chat:${clientAddress}`, { windowMs: 60_000, max: 20 })
  if (!limit.ok) {
    return new Response(
      JSON.stringify({ error: '请求过于频繁，请稍后再试' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  let body: ChatRequest
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { messages = [], useRag = true, model, temperature = 0.7 } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('messages required', { status: 400 })
  }
  if (messages.length > MAX_MESSAGES) {
    return new Response(
      JSON.stringify({ error: `messages 数量 ${messages.length} 超过上限 ${MAX_MESSAGES}` }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 校验每条 message 的形状 + 累计 content 长度
  let totalLen = 0
  for (const m of messages) {
    if (!m || typeof m.content !== 'string') {
      return new Response('invalid message shape', { status: 400 })
    }
    if (m.content.length > MAX_CONTENT_PER_MESSAGE) {
      return new Response(
        JSON.stringify({ error: `单条消息 ${m.content.length} 字符超过上限 ${MAX_CONTENT_PER_MESSAGE}` }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      )
    }
    totalLen += m.content.length
  }
  if (totalLen > MAX_TOTAL_CONTENT) {
    return new Response(
      JSON.stringify({ error: `总消息长度 ${totalLen} 超过上限 ${MAX_TOTAL_CONTENT}` }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  if (!lastUser) {
    return new Response('no user message', { status: 400 })
  }

  // 检索上下文
  let context: RetrievedChunk[] = []
  let retrievalMode: 'vector' | 'keyword' | 'none' = 'none'
  if (useRag) {
    try {
      const hasIndex = await loadIndex()
      if (hasIndex) {
        const queryVec = await lmEmbed(lastUser.content)
        retrievalMode = queryVec ? 'vector' : 'keyword'
        context = await retrieveContext(lastUser.content)
      }
    } catch {
      // 检索失败时使用空上下文，由 LLM 直接回答
    }
  }

  const systemPrompt = buildSystemPrompt(context)
  const finalMessages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  // 调用 LM Studio LLM
  let upstreamRes: Response
  try {
    upstreamRes = await lmFetch(
      llmConfig,
      '/chat/completions',
      {
        model: model || DEFAULT_MODEL,
        messages: finalMessages,
        temperature,
        stream: true,
      }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: `无法连接 LM Studio（${BASE_URL}）。请确认 LM Studio 已启动并启用本地服务。`,
        detail: err.message,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    const text = await upstreamRes.text().catch(() => '')
    return new Response(
      JSON.stringify({
        error: `LM Studio 返回 ${upstreamRes.status}`,
        detail: text.slice(0, 500),
      }),
      {
        status: upstreamRes.status,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // 透传 SSE
  const transform = new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(chunk)
    },
  })

  return new Response(upstreamRes.body.pipeThrough(transform), {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Context-Post-Titles': encodeURIComponent(
        JSON.stringify(context.map((c) => ({ title: c.postTitle, url: c.postUrl, score: c.score })))
      ),
      'X-Retrieval-Mode': retrievalMode,
    },
  })
}

/** 健康检查（返回 LLM + embedding 双状态） */
export const GET: APIRoute = async () => {
  const result: Record<string, any> = { llm: { ok: false }, embedding: { ok: false } }
  try {
    const r = await lmGet(llmConfig, '/models')
    if (r.ok) {
      const d = await r.json()
      result.llm.ok = true
      result.llm.models = (d.data ?? []).map((m: any) => m.id)
    } else {
      result.llm.error = `HTTP ${r.status}`
    }
  } catch (err: any) {
    result.llm.error = err.message
  }

  if (EMBEDDING_MODEL) {
    try {
      const v = await lmEmbed('test')
      result.embedding.ok = !!v
      result.embedding.model = EMBEDDING_MODEL
      result.embedding.dimension = v?.length ?? 0
      result.embedding.baseUrl = EMBEDDING_BASE_URL
    } catch (err: any) {
      result.embedding.error = err.message
    }
  } else {
    result.embedding.error = 'EMBEDDING_MODEL 未配置（将使用关键词降级）'
  }

  // 索引状态
  const idx = await loadIndex()
  result.index = idx
    ? { chunks: idx.totalChunks, model: idx.model, dim: idx.dimension }
    : { chunks: 0, error: '未构建' }

  const status = result.llm.ok ? 200 : 503
  return new Response(JSON.stringify(result, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * 轻量级存活检查（不调用任何外部服务）
 * 用途：前端定时心跳 / 打开聊天窗口时快速判断
 * HEAD 返回 200 / 503 + 极简 body
 */
export const HEAD: APIRoute = async () => {
  const idx = await loadIndex()
  const ok = idx !== null
  return new Response(null, {
    status: ok ? 200 : 503,
    headers: {
      'X-Index-Ready': ok ? '1' : '0',
    },
  })
}
