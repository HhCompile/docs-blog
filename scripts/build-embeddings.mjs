#!/usr/bin/env node
/**
 * 构建时 embedding 生成
 *
 * 工作流程:
 *  1. 读取 src/content/posts/*.md
 *  2. 按 chunker 逻辑切分
 *  3. 批量调用 LM Studio /v1/embeddings
 *  4. 写入 dist/client/blog-embeddings.json
 *
 * 用法: pnpm embed
 *
 * 配置（.env）:
 *   LMSTUDIO_BASE_URL    默认 http://localhost:1234/v1
 *   LMSTUDIO_API_KEY     默认 lm-studio
 *   EMBEDDING_MODEL      必填，如 text-embedding-nomic-embed-text-v1.5
 */

import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import matter from 'gray-matter'

const ROOT = path.resolve(process.cwd(), 'src/content/posts')
const OUT = path.resolve(process.cwd(), 'dist/client/blog-embeddings.json')

const BASE_URL = process.env.EMBEDDING_BASE_URL || process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'
const API_KEY = process.env.EMBEDDING_API_KEY || process.env.LMSTUDIO_API_KEY || 'lm-studio'
const MODEL = process.env.EMBEDDING_MODEL
const BATCH_SIZE = 16 // 每次请求最多嵌入多少文本
const MAX_CHARS = 1500 // 截断到 LM Studio 支持的长度

if (!MODEL) {
  console.error('❌ 缺少 EMBEDDING_MODEL 环境变量。')
  console.error('   在 .env 中设置 EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5')
  console.error('   提示：在 LM Studio 中搜索并加载一个 embedding 模型。')
  process.exit(1)
}

/* ───── 复用 chunker 逻辑（保持与服务端一致） ───── */

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

function chunkText(text, id, baseMeta) {
  const MAX = 800
  const MIN = 100
  if (text.length <= MAX) {
    return [{ ...baseMeta, id: `${id}#0`, text, offset: 0 }]
  }
  const sentences = text.split(/(?<=[。！？.!?])\s+/)
  const chunks = []
  let buffer = ''
  let currentOffset = 0
  for (const s of sentences) {
    if (buffer.length + s.length > MAX && buffer.length >= MIN) {
      chunks.push({ ...baseMeta, id: `${id}#${chunks.length}`, text: buffer.trim(), offset: currentOffset })
      buffer = ''
    }
    buffer += s + ' '
    currentOffset += s.length + 1
  }
  if (buffer.trim().length >= MIN) {
    chunks.push({ ...baseMeta, id: `${id}#${chunks.length}`, text: buffer.trim(), offset: currentOffset })
  } else if (chunks.length > 0) {
    chunks[chunks.length - 1].text += ' ' + buffer.trim()
  }
  return chunks
}

async function listMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) files.push(...(await listMarkdownFiles(full)))
    else if (/\.(md|mdx)$/.test(e.name) && !e.name.startsWith('_')) files.push(full)
  }
  return files
}

async function readAllChunks() {
  const files = await listMarkdownFiles(ROOT)
  const all = []
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf-8')
    const { data: fm, content } = matter(raw)
    if (fm.draft) continue
    const id = path.basename(file, path.extname(file))
    const baseMeta = {
      postId: id,
      postTitle: fm.title || id,
      postDate: fm.date ? new Date(fm.date).toISOString().slice(0, 10) : '',
      postUrl: `/posts/${id}`,
      tags: fm.tags || [],
    }
    const text = stripMarkdown(content)
    const chunks = chunkText(text, id, baseMeta)
    all.push(...chunks)
  }
  return all
}

/* ───── 批量 embedding ───── */

async function embedBatch(texts) {
  const url = `${BASE_URL.replace(/\/+$/, '')}/embeddings`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ input: texts, model: MODEL }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`)
  }
  const json = await res.json()
  return json.data.map((d) => d.embedding)
}

async function main() {
  console.log('📚 读取文章...')
  const chunks = await readAllChunks()
  console.log(`✂️  共 ${chunks.length} 个切片`)

  if (chunks.length === 0) {
    console.warn('⚠️  没有切片，跳过 embedding 生成')
    return
  }

  console.log(`🔌 连接 embedding 服务 ${BASE_URL}，模型 ${MODEL}`)

  // 测试连接
  try {
    await embedBatch(['ping'])
  } catch (err) {
    console.error('❌ 无法连接 embedding 服务：', err.message)
    console.error('   请确认：')
    console.error(`   1. EMBEDDING_BASE_URL=${BASE_URL} 可访问`)
    console.error('   2. 已加载 embedding 模型（不是 LLM）')
    console.error(`   3. EMBEDDING_MODEL=${MODEL} 与远程服务加载的模型一致`)
    console.error('   4. 如果是远程电脑，确认网络可达 + 防火墙放行')
    process.exit(1)
  }

  const allEmbeddings = []
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE)

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const batchNo = Math.floor(i / BATCH_SIZE) + 1
    const texts = batch.map((c) => c.text.slice(0, MAX_CHARS))
    process.stdout.write(`  [${batchNo}/${totalBatches}] embedding ${texts.length} 文本... `)
    try {
      const vectors = await embedBatch(texts)
      vectors.forEach((vec, idx) => {
        allEmbeddings.push({
          id: batch[idx].id,
          postId: batch[idx].postId,
          postTitle: batch[idx].postTitle,
          postUrl: batch[idx].postUrl,
          tags: batch[idx].tags,
          offset: batch[idx].offset,
          text: batch[idx].text,
          vector: vec,
        })
      })
      console.log('✓')
    } catch (err) {
      console.log(`✗ ${err.message}`)
      throw err
    }
  }

  // 写入
  await fs.mkdir(path.dirname(OUT), { recursive: true })
  await fs.writeFile(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        model: MODEL,
        dimension: allEmbeddings[0]?.vector.length || 0,
        totalChunks: allEmbeddings.length,
        items: allEmbeddings,
      }
    )
  )

  const sizeKB = (JSON.stringify(allEmbeddings).length / 1024).toFixed(1)
  console.log(`\n✅ 完成！写入 ${OUT}`)
  console.log(`   ${allEmbeddings.length} 个向量，维度 ${allEmbeddings[0]?.vector.length || 0}，文件 ${sizeKB} KB`)
  console.log('\n💡 下一步：pnpm build（会在构建前自动调本脚本）')
}

main().catch((err) => {
  console.error('💥 异常:', err)
  process.exit(1)
})
