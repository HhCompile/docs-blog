/** @jsxImportSource react */
import { useMemo, useState } from 'react'
import Icon from './Icon'
import type { Tag } from '../data/tag-helpers'

export interface TagFilterProps {
  tags: (Tag & { count: number })[]
  onFilter?: (selected: string[]) => void
}

/**
 * 标签筛选器 - React 岛
 * 选中状态以"并集"累积，可清空/全选
 * 注：纯客户端筛选时使用 onFilter；服务器筛选时用 URL 参数更利于 SEO
 */
export default function TagFilter({ tags }: TagFilterProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const sorted = useMemo(
    () => [...tags].sort((a, b) => b.count - a.count),
    [tags]
  )

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function clear() {
    setSelected(new Set())
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Icon name="tag" size={14} className="text-brand-600" />
          按标签筛选
        </h3>
        {selected.size > 0 && (
          <button
            onClick={clear}
            className="text-xs text-gray-500 hover:text-brand-600"
          >
            清空 ({selected.size})
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {sorted.map((tag) => {
          const isActive = selected.has(tag.id)
          return (
            <button
              key={tag.id}
              onClick={() => toggle(tag.id)}
              title={tag.description}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'ring-2 ring-offset-1 scale-105'
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                ['--tw-ring-color' as string]: tag.color,
              } as React.CSSProperties}
            >
              {tag.name}
              <span className="text-[10px] opacity-70">{tag.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
