#!/usr/bin/env node
/**
 * 自动发布到 CSDN / 掘金
 *
 * 用法:
 *   pnpm publish                 # 推送所有 front matter 中 publish.csdn/juejin=true 的文章
 *   pnpm publish --dry-run       # 只打印计划，不实际推送
 *   pnpm publish --file=xxx.md    # 推送指定文章
 *   pnpm publish --platform=csdn # 强制指定平台（覆盖 front matter）
 *
 * 配置文件: .env （参考 .env.example）
 *
 * ⚠️ 安全提示:
 *   - CSDN/掘金无官方 OpenAPI，本脚本通过抓取 Cookie 模拟请求
 *   - Cookie 包含登录态，泄露有账号风险，请妥善保管 .env
 *   - 频繁请求可能触发风控，建议间隔 60s+
 */

import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import matter from 'gray-matter'

const ROOT = path.resolve(process.cwd(), 'src/content/posts')
const ARGS = parseArgs(process.argv.slice(2))

async function main() {
  const target = ARGS.file ? path.resolve(ARGS.file) : null
  const platform = ARGS.platform || null // 'csdn' | 'juejin' | null
  const dryRun = Boolean(ARGS['dry-run'])

  const files = target
    ? [target]
    : await listMarkdownFiles(ROOT)

  console.log(`📚 扫描到 ${files.length} 个 Markdown 文件`)
  if (dryRun) console.log('🧪 DRY-RUN 模式：不会实际推送\n')

  let success = 0
  let skipped = 0
  let failed = 0

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf-8')
    const { data: fm, content } = matter(raw)
    const slug = path.basename(file, path.extname(file))
    const title = fm.title || slug

    const publishCfg = fm.publish || {}
    const targets = []
    if (platform) targets.push(platform)
    else {
      if (publishCfg.csdn) targets.push('csdn')
      if (publishCfg.juejin) targets.push('juejin')
    }

    if (targets.length === 0) {
      if (ARGS.verbose) console.log(`⏭  ${title} (未配置发布目标)`)
      skipped++
      continue
    }

    if (fm.draft) {
      console.log(`⏭  ${title} (草稿，跳过)`)
      skipped++
      continue
    }

    for (const p of targets) {
      const tag = `→ ${p.padEnd(6)}`
      try {
        if (dryRun) {
          console.log(`🧪 ${tag} ${title} (${content.length} 字符)`)
          continue
        }
        console.log(`📤 ${tag} ${title} ...`)
        await dispatch(p, { title, content, tags: fm.tags || [], description: fm.description })
        console.log(`✅ ${tag} ${title} 成功\n`)
        success++
      } catch (err) {
        console.error(`❌ ${tag} ${title} 失败: ${err.message}\n`)
        failed++
      }
    }
  }

  console.log('─'.repeat(40))
  console.log(`✅ 成功: ${success}  ⏭  跳过: ${skipped}  ❌ 失败: ${failed}`)

  if (failed > 0) process.exit(1)
}

function parseArgs(argv) {
  const out = {}
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      out[k] = v ?? true
    }
  }
  return out
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

/** 路由到具体平台 */
async function dispatch(platform, payload) {
  switch (platform) {
    case 'csdn':
      return publishToCsdn(payload)
    case 'juejin':
      return publishToJuejin(payload)
    default:
      throw new Error(`未知平台: ${platform}`)
  }
}

/* ──────────────── CSDN ──────────────── */

async function publishToCsdn({ title, content, tags, description }) {
  const cookie = process.env.CSDN_COOKIE
  const category = process.env.CSDN_CATEGORY || '前端'
  if (!cookie) {
    throw new Error('CSDN_COOKIE 未配置，参考 .env.example')
  }

  // CSDN 编辑器保存草稿接口（截至 2025 仍可用，但接口可能变更）
  const url = 'https://blog.csdn.net/phoenix/article/save'
  const body = new URLSearchParams({
    title,
    content: content.trim(),
    markdowncontent: content.trim(),
    categories: category,
    tags: tags.join(','),
    description: description || '',
    type: 'original',
    status: 'publish', // 'draft' | 'publish'
    articleId: '',
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Referer: 'https://editor.csdn.net/markdown/',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
  })

  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`响应非 JSON: ${text.slice(0, 200)}`)
  }

  if (!res.ok || json.code !== 200) {
    throw new Error(json.message || json.msg || `HTTP ${res.status}`)
  }
  return json
}

/* ──────────────── 掘金 ──────────────── */

async function publishToJuejin({ title, content, tags: _tags, description }) {
  const cookie = process.env.JUEJIN_COOKIE
  const categoryId = process.env.JUEJIN_CATEGORY_ID || '6809637767543259144'
  const tagIds = (process.env.JUEJIN_TAG_IDS || '').split(',').filter(Boolean)

  if (!cookie) {
    throw new Error('JUEJIN_COOKIE 未配置，参考 .env.example')
  }

  // 1. 创建草稿
  const createUrl = 'https://api.juejin.cn/content_api/v1/article_draft/create'
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    body: JSON.stringify({
      category_id: categoryId,
      tag_ids: tagIds,
      link_url: '',
      cover_image: '',
      title,
      brief_content: description || content.slice(0, 100),
      is_need_associate_image: false,
      is_gems: false,
      codelang: 'Markdown',
      content,
      edit_type: 10,
    }),
  })

  const createJson = await createRes.json()
  if (createJson.err_no !== 0) {
    throw new Error(`创建草稿失败: ${createJson.err_msg}`)
  }
  const draftId = createJson.data.id

  // 2. 发布草稿
  const publishUrl = 'https://api.juejin.cn/content_api/v1/article/publish'
  const pubRes = await fetch(publishUrl, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      draft_id: draftId,
      category_id: categoryId,
      tag_ids: tagIds,
      link_url: '',
      cover_image: '',
      title,
      brief_content: description || content.slice(0, 100),
      is_need_associate_image: false,
      is_gems: false,
      codelang: 'Markdown',
    }),
  })

  const pubJson = await pubRes.json()
  if (pubJson.err_no !== 0) {
    throw new Error(`发布失败: ${pubJson.err_msg}`)
  }
  return pubJson
}

main().catch((err) => {
  console.error('💥 脚本异常:', err)
  process.exit(1)
})
