/**
 * 文章存储层（CMS）
 * 直接读写服务器上的 src/content/posts/*.md
 * 所有写操作自动 git commit，发布时触发构建
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import matter from 'gray-matter'

// 服务器部署时：仓库根 = 进程工作目录（/opt/docs-blog）
// 本地开发时：仓库根 = 项目根
const REPO_ROOT = process.cwd()
const POSTS_DIR = path.join(REPO_ROOT, 'src', 'content', 'posts')
const TRASH_DIR = path.join(REPO_ROOT, 'src', 'content', 'posts', '.trash')

export interface PostMeta {
  title: string
  description?: string
  date: string
  updated?: string
  tags: string[]
  draft?: boolean
  cover?: string
  coverAlt?: string
  [key: string]: unknown
}

export interface Post {
  slug: string
  meta: PostMeta
  body: string
  raw: string
  inTrash?: boolean
}

/** slug 白名单：只允许小写字母数字连字符 */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function safeSlug(slug: string): string {
  const s = slug.trim()
  if (!SLUG_RE.test(s)) throw new Error(`非法 slug: ${slug}`)
  return s
}

function git(...args: string[]): void {
  try {
    execSync(`git ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`, {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    })
  } catch (e: any) {
    // git 失败不致命（如 .git 不存在时），静默记录
    console.warn(`[post-store] git ${args[0]} failed:`, e.message)
  }
}

function gitOutput(...args: string[]): string {
  try {
    return execSync(`git ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`, {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
    }).trim()
  } catch {
    return ''
  }
}

/** 生成 slug：标题 → kebab-case */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  // 纯中文标题无 ASCII 字符时补随机后缀避免重复
  const ascii = slug.replace(/[\u4e00-\u9fa5]/g, '').replace(/-+/g, '').trim()
  const base = ascii || `post-${Date.now().toString(36)}`
  return base.replace(/^-|-$/g, '')
}

/** 读取单篇文章（支持 trash 内读取） */
export async function readPost(slug: string, { inTrash = false } = {}): Promise<Post | null> {
  const safe = safeSlug(slug)
  const dir = inTrash ? TRASH_DIR : POSTS_DIR
  const file = path.join(dir, `${safe}.md`)
  try {
    const raw = await fs.readFile(file, 'utf8')
    const { data, content } = matter(raw)
    // 规范化 date：gray-matter 会解析为 Date 对象，统一转 YYYY-MM-DD
    let dateStr = ''
    if (data.date) {
      const d = new Date(data.date)
      dateStr = isNaN(d.getTime()) ? String(data.date) : d.toISOString().slice(0, 10)
    }
    const meta = { ...data, date: dateStr } as PostMeta
    return {
      slug: safe,
      meta,
      body: content.trim(),
      raw,
      inTrash,
    }
  } catch {
    return null
  }
}

/** 文章列表（含草稿，不含 trash） */
export async function listPosts(): Promise<Post[]> {
  await fs.mkdir(POSTS_DIR, { recursive: true })
  const files = await fs.readdir(POSTS_DIR)
  const mdFiles = files.filter((f) => f.endsWith('.md'))
  const posts: Post[] = []
  for (const f of mdFiles) {
    const slug = f.replace(/\.md$/, '')
    const post = await readPost(slug)
    if (post) posts.push(post)
  }
  // 按日期倒序（date 可能是 Date 对象或字符串）
  posts.sort((a, b) => {
    const da = new Date(a.meta.date || 0).getTime()
    const db = new Date(b.meta.date || 0).getTime()
    return db - da
  })
  return posts
}

/** 软删除列表 */
export async function listTrash(): Promise<Post[]> {
  await fs.mkdir(TRASH_DIR, { recursive: true })
  const files = await fs.readdir(TRASH_DIR)
  const mdFiles = files.filter((f) => f.endsWith('.md'))
  const posts: Post[] = []
  for (const f of mdFiles) {
    const slug = f.replace(/\.md$/, '')
    const post = await readPost(slug, { inTrash: true })
    if (post) posts.push(post)
  }
  return posts
}

/** 写入文章（新建或更新） */
export async function writePost(slug: string, meta: PostMeta, body: string): Promise<Post> {
  const safe = safeSlug(slug)
  await fs.mkdir(POSTS_DIR, { recursive: true })
  const file = path.join(POSTS_DIR, `${safe}.md`)
  const raw = matter.stringify(body.trim() + '\n', meta)
  await fs.writeFile(file, raw, 'utf8')
  git('add', file)
  git('commit', '-m', `cms: update post ${safe}`)
  return { slug: safe, meta, body: body.trim(), raw }
}

/** 新建文章 */
export async function createPost(title: string): Promise<Post> {
  const base = slugify(title)
  let slug = base
  let n = 2
  while (await fs.access(path.join(POSTS_DIR, `${slug}.md`)).then(() => true).catch(() => false)) {
    slug = `${base}-${n++}`
  }
  const today = new Date().toISOString().slice(0, 10)
  const meta: PostMeta = { title: title || slug, description: '', date: today, tags: [], draft: true }
  return writePost(slug, meta, `# ${title || slug}\n`)
}

/** 软删除：移入 .trash/ */
export async function softDelete(slug: string): Promise<boolean> {
  const safe = safeSlug(slug)
  const src = path.join(POSTS_DIR, `${safe}.md`)
  const dest = path.join(TRASH_DIR, `${safe}.md`)
  await fs.mkdir(TRASH_DIR, { recursive: true })
  try {
    await fs.rename(src, dest)
    git('add', '-A', 'src/content/posts')
    git('commit', '-m', `cms: soft delete ${safe}`)
    return true
  } catch {
    return false
  }
}

/** 从回收站恢复 */
export async function restorePost(slug: string): Promise<boolean> {
  const safe = safeSlug(slug)
  const src = path.join(TRASH_DIR, `${safe}.md`)
  const dest = path.join(POSTS_DIR, `${safe}.md`)
  try {
    await fs.rename(src, dest)
    git('add', '-A', 'src/content/posts')
    git('commit', '-m', `cms: restore ${safe}`)
    return true
  } catch {
    return false
  }
}

/** 彻底删除（仅回收站内） */
export async function hardDelete(slug: string): Promise<boolean> {
  const safe = safeSlug(slug)
  const file = path.join(TRASH_DIR, `${safe}.md`)
  try {
    await fs.unlink(file)
    git('add', '-A', 'src/content/posts')
    git('commit', '-m', `cms: hard delete ${safe}`)
    return true
  } catch {
    return false
  }
}

/** 发布：git push + 构建 + 重启服务 */
export async function publish(): Promise<{ ok: boolean; message: string }> {
  try {
    // 1. 提交并推送
    git('add', '-A')
    git('commit', '-m', `cms: publish ${new Date().toISOString()}`)
    const branch = gitOutput('rev-parse', '--abbrev-ref', 'HEAD') || 'main'
    git('push', 'origin', branch)

    // 2. 构建（服务器本地）
    console.log('[publish] building...')
    execSync('pnpm run build:no-ai', { cwd: REPO_ROOT, stdio: 'pipe', timeout: 600_000 })
    console.log('[publish] build ok')

    // 3. 重启服务（仅生产环境有 systemd）
    try {
      execSync('systemctl restart docs-blog', { stdio: 'pipe' })
    } catch {
      // 本地环境无 systemd，跳过
    }

    return { ok: true, message: '发布成功' }
  } catch (e: any) {
    // 构建失败回滚
    try {
      execSync('git checkout -- .', { cwd: REPO_ROOT, stdio: 'pipe' })
    } catch {
      // ignore
    }
    return { ok: false, message: `发布失败: ${e.message}` }
  }
}
