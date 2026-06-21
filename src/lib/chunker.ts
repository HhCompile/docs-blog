/**
 * 文章内容切片器
 * - 提取 front matter 与正文
 * - 按段落 / 标题切分，控制在 500-800 字每片
 * - 保留每个切片的 URL（用于在 AI 回答中引用来源）
 */
import type { CollectionEntry } from 'astro:content'

export interface Chunk {
  id: string
  postId: string
  postTitle: string
  postDate: string
  postUrl: string
  tags: string[]
  text: string
  /** 切片在 stripped 正文中的字符起始位置（用于生成锚点） */
  offset: number
}

const MAX_CHUNK_SIZE = 800
const MIN_CHUNK_SIZE = 100

/** 极简的 Markdown 剥离（保留段落分隔） */
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // 移除代码块
    .replace(/`[^`]*`/g, ' ') // 移除行内代码
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 移除图片
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // 链接保留文字
    .replace(/^#{1,6}\s+/gm, '') // 移除标题符号
    .replace(/[*_~]+/g, '') // 移除强调符号
    .replace(/\s+/g, ' ')
    .trim()
}

export function chunkPost(post: CollectionEntry<'posts'>): Chunk[] {
  const raw = post.body ?? ''
  const stripped = stripMarkdown(raw)
  const postUrl = `/posts/${post.id}`
  const baseMeta = {
    postId: post.id,
    postTitle: post.data.title,
    postDate: post.data.date.toISOString().slice(0, 10),
    postUrl,
    tags: post.data.tags ?? [],
  }

  if (stripped.length <= MAX_CHUNK_SIZE) {
    return [
      {
        ...baseMeta,
        id: `${post.id}#0`,
        text: stripped,
        offset: 0,
      },
    ]
  }

  // 按句子切分（中文/英文标点都支持）
  const sentences = stripped.split(/(?<=[。！？.!?])\s+/)
  const chunks: Chunk[] = []
  let buffer = ''
  let chunkStart = 0 // 当前 buffer 在 stripped 中的起始偏移
  let cursor = 0 // 已扫描到的 stripped 偏移

  for (const sentence of sentences) {
    // 决定是否在追加前先 flush
    const wouldOverflow = buffer.length + sentence.length > MAX_CHUNK_SIZE
    const canFlush = buffer.length >= MIN_CHUNK_SIZE

    if (wouldOverflow && canFlush) {
      const flushedText = buffer.trim()
      if (flushedText.length > 0) {
        chunks.push({
          ...baseMeta,
          id: `${post.id}#${chunks.length}`,
          text: flushedText,
          offset: chunkStart,
        })
      }
      // 下一片从 cursor 开始（跳过 flush 走的部分）
      chunkStart = cursor
      buffer = ''
    }

    buffer += sentence + ' '
    cursor += sentence.length + 1
  }

  // 处理尾部 buffer
  const tail = buffer.trim()
  if (tail.length >= MIN_CHUNK_SIZE) {
    chunks.push({
      ...baseMeta,
      id: `${post.id}#${chunks.length}`,
      text: tail,
      offset: chunkStart,
    })
  } else if (tail.length > 0 && chunks.length > 0) {
    // 把尾部短块拼到上一块
    chunks[chunks.length - 1].text += ' ' + tail
  }

  return chunks
}
