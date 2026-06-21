/** @jsxImportSource react */
import { useMemo, useState } from 'react'
import Icon from './Icon'
import type { PostSummary } from './PostList'
import TagBadge from './TagBadge'

export interface PostListFilterProps {
  posts: PostSummary[]
  allTags: { id: string; name: string; color: string }[]
}

/**
 * 文章列表 + 客户端筛选（React 岛）
 * 用于 /posts 页面：按标签实时筛选
 */
export default function PostListFilter({ posts, allTags }: PostListFilterProps) {
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    return posts.filter((post) => {
      // 标签筛选（任一命中）
      if (activeTags.size > 0) {
        const hit = post.tags.some((t) => activeTags.has(t))
        if (!hit) return false
      }
      // 关键词筛选
      if (query.trim()) {
        const q = query.trim().toLowerCase()
        const haystack = `${post.title} ${post.description}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [posts, activeTags, query])

  function toggleTag(id: string) {
    const next = new Set(activeTags)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setActiveTags(next)
  }

  return (
    <div>
      {/* 搜索框 */}
      <div className="mb-4 relative">
        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="搜索文章标题或摘要..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* 标签筛选条 */}
      <div className="mb-6 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 mr-1">标签:</span>
        {allTags.map((tag) => (
          <TagBadge
            key={tag.id}
            id={tag.id}
            name={tag.name}
            color={tag.color}
            active={activeTags.has(tag.id)}
            onClick={() => toggleTag(tag.id)}
          />
        ))}
        {activeTags.size > 0 && (
          <button
            onClick={() => setActiveTags(new Set())}
            className="text-xs text-gray-500 hover:text-brand-600 ml-1"
          >
            清空
          </button>
        )}
      </div>

      {/* 统计 */}
      <p className="text-sm text-gray-500 mb-3">
        共 <strong className="text-brand-600">{filtered.length}</strong> 篇文章
        {activeTags.size > 0 && `（已筛选）`}
      </p>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Icon name="file-search-outline" size={40} className="mb-2 inline-block" />
          <p>没有匹配的文章</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {filtered.map((post) => (
            <li
              key={post.slug}
              className="card hover:shadow-md transition-shadow"
            >
              <a href={`/posts/${post.slug}`} className="block">
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                  <span className="flex items-center gap-1">
                    <Icon name="calendar" size={12} />
                    {post.date}
                  </span>
                </div>
                <h3 className="text-lg font-bold mb-1 hover:text-brand-600">
                  {post.title}
                </h3>
                {post.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {post.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {post.tags.map((tagId) => {
                    const tag = allTags.find((t) => t.id === tagId)
                    if (!tag) return null
                    return (
                      <TagBadge
                        key={tagId}
                        id={tag.id}
                        name={tag.name}
                        color={tag.color}
                        active={activeTags.has(tag.id)}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleTag(tag.id)
                        }}
                      />
                    )
                  })}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
