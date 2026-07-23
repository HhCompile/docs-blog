#!/usr/bin/env node
/**
 * 构建 KnowledgeBase 笔记的 embedding
 *
 * 与 build-embeddings.mjs 共用环境变量，输出独立文件
 *
 * 用法: node scripts/build-notes-embeddings.mjs
 * 输出: dist/client/notes-embeddings.json
 */

import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import matter from 'gray-matter'

const ROOT = '/Users/hh/www/KnowledgeBase'
const OUT = path.resolve(process.cwd(), 'dist/client/notes-embeddings.json')

const BATCH_SIZE = 16
const MAX_CHARS = 1500

const BASE_URL = process.env.EMBEDDING_BASE_URL || process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'
const API_KEY = process.env.EMBEDDING_API_KEY || process.env.LMSTUDIO_API_KEY || 'lm-studio'
const MODEL = process.env.EMBEDDING_MODEL

if (!MODEL) {
  console.error('❌ 缺少 EMBEDDING_MODEL 环境变量。')
  process.exit(1)
}

/* ───── chunker ───── */
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
    if (e.name.startsWith('.') || e.name.startsWith('01-') || e.name.startsWith('#')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) files.push(...(await listMarkdownFiles(full)))
    else if (/\.md$/.test(e.name)) files.push(full)
  }
  return files
}

/* ───── embedding ───── */
async function embedBatch(texts) {
  const url = `${BASE_URL.replace(/\/+$/, '')}/embeddings`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ input: texts, model: MODEL }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`)
  }
  const json = await res.json()
  return json.data.map((d) => d.embedding)
}

function relativeId(filePath) {
  return path.relative(ROOT, filePath).replace(/\.md$/, '')
}

async function main() {
  console.log('📚 读取知识库笔记...')
  const files = await listMarkdownFiles(ROOT)
  console.log(`   发现 ${files.length} 个 md 文件`)

  const allChunks = []
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf-8')
    const { data: fm, content } = matter(raw)
    const id = relativeId(file)
    const baseMeta = {
      noteId: id,
      noteTitle: fm.title || path.basename(file, '.md'),
      noteUrl: `/notes/${id}`,
      tags: Array.isArray(fm.tags) ? fm.tags : [],
    }
    const text = stripMarkdown(content)
    const chunks = chunkText(text, id, baseMeta)
    allChunks.push(...chunks)
  }

  console.log(`✂️  共 ${allChunks.length} 个切片`)

  if (allChunks.length === 0) {
    console.warn('⚠️  没有切片，跳过')
    return
  }

  // 测试连接
  try {
    await embedBatch(['ping'])
  } catch (err) {
    console.error('❌ 无法连接 embedding 服务：', err.message)
    process.exit(1)
  }

  const allEmbeddings = []
  const totalBatches = Math.ceil(allChunks.length / BATCH_SIZE)

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE)
    const batchNo = Math.floor(i / BATCH_SIZE) + 1
    const texts = batch.map((c) => c.text.slice(0, MAX_CHARS))
    process.stdout.write(`  [${batchNo}/${totalBatches}] embedding ${texts.length} 文本... `)
    const vectors = await embedBatch(texts)
    vectors.forEach((vec, idx) => {
      allEmbeddings.push({
        id: batch[idx].id,
        noteId: batch[idx].noteId,
        noteTitle: batch[idx].noteTitle,
        noteUrl: batch[idx].noteUrl,
        tags: batch[idx].tags,
        offset: batch[idx].offset,
        text: batch[idx].text,
        vector: vec,
      })
    })
    console.log('✓')
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true })
  await fs.writeFile(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    model: MODEL,
    dimension: allEmbeddings[0]?.vector.length || 0,
    totalChunks: allEmbeddings.length,
    items: allEmbeddings,
  }))

  const sizeKB = (JSON.stringify(allEmbeddings).length / 1024).toFixed(1)
  console.log(`\n✅ 完成！写入 ${OUT}`)
  console.log(`   ${allEmbeddings.length} 个向量，文件 ${sizeKB} KB`)
}

main().catch((err) => {
  console.error('💥 异常:', err)
  process.exit(1)
})
