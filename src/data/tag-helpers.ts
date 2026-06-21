import tagsData from './tags.json'

export interface Tag {
  id: string
  name: string
  color: string
  description: string
}

// 类型守卫 + 缓存
const tagMap = new Map<string, Tag>(
  (tagsData as Tag[]).map((t) => [t.id, t])
)

/** 通过 ID 获取标签元数据 */
export function getTag(id: string): Tag | undefined {
  return tagMap.get(id)
}

/** 通过 ID 列表获取标签元数据列表（自动过滤不存在的） */
export function getTags(ids: string[] = []): Tag[] {
  return ids.map((id) => tagMap.get(id)).filter((t): t is Tag => Boolean(t))
}

/** 列出全部标签（按 id 排序） */
export function listTags(): Tag[] {
  return [...tagMap.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** 文章计数（用于标签云展示）
 *  参数为 getter 形式：传入 `(p) => p.tags` 让调用方提供 tag 字段，
 *  这样 CollectionEntry / 普通对象都能传入（绕过结构化类型不匹配）。
 */
export function countPostsByTag<T>(
  posts: readonly T[],
  getTags: (post: T) => readonly string[] | undefined | null
): Map<string, number> {
  const map = new Map<string, number>()
  for (const post of posts) {
    for (const id of getTags(post) ?? []) {
      map.set(id, (map.get(id) ?? 0) + 1)
    }
  }
  return map
}
