/**
 * 计算相关文章
 * 评分：同标签数 × 3 + 时间近度（30 天衰减）
 * 同标签越多越相关，越新的文章权重越高
 */
import type { CollectionEntry } from 'astro:content'

export function getRelatedPosts(
  currentId: string,
  currentTags: readonly string[],
  allPosts: readonly CollectionEntry<'posts'>[],
  limit = 4
): CollectionEntry<'posts'>[] {
  return allPosts
    .filter((p) => p.id !== currentId)
    .map((p) => {
      const overlap = (p.data.tags ?? []).filter((t) => currentTags.includes(t)).length
      const ageMs = Date.now() - p.data.date.valueOf()
      const recencyScore = 1 / (1 + ageMs / (1000 * 60 * 60 * 24 * 30))
      return { post: p, score: overlap * 3 + recencyScore }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.post)
}
