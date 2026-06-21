/** @jsxImportSource react */

export interface TagBadgeProps {
  id: string
  name: string
  color: string
  active?: boolean
  onClick?: (e: React.MouseEvent) => void
}

export default function TagBadge({
  id,
  name,
  color,
  active = false,
  onClick,
}: TagBadgeProps) {
  return (
    <button
      onClick={onClick}
      data-tag-id={id}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
        active ? 'ring-2 ring-offset-1' : 'opacity-80 hover:opacity-100'
      }`}
      style={{
        backgroundColor: `${color}20`,
        color,
        ['--tw-ring-color' as string]: color,
      } as React.CSSProperties}
    >
      {name}
    </button>
  )
}
