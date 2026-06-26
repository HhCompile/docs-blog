/** @jsxImportSource react */
/**
 * Icon 组件（React 岛版本）
 * 底层用 astro-icon 渲染 Iconify SVG 集合
 * - 服务端预渲染：零运行时 JS
 * - 兼容旧 lucide API
 */
import { Icon as AstroIcon } from 'astro-icon/components'

export type IconName =
  | 'alert-circle'
  | 'arrow-left'
  | 'arrow-right'
  | 'book-open'
  | 'bot'
  | 'calendar'
  | 'check'
  | 'chevron-down'
  | 'chevron-up'
  | 'clock'
  | 'close'
  | 'copy'
  | 'counter'
  | 'delete-sweep'
  | 'file-document-multiple'
  | 'file-search'
  | 'file-search-outline'
  | 'format-list-bulleted'
  | 'github'
  | 'home'
  | 'link-variant'
  | 'loading'
  | 'menu'
  | 'moon'
  | 'pencil'
  | 'refresh'
  | 'rss'
  | 'search'
  | 'send'
  | 'sitemap'
  | 'stop'
  | 'sun'
  | 'tag-multiple'
  | 'tag'
  | 'text'
  | 'text-search'
  | 'weather-night'
  | 'weather-sunny'
  | 'x'

export interface IconProps {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  spin?: boolean
}

export default function Icon({
  name,
  size = 18,
  strokeWidth = 2,
  className = '',
  spin = false,
}: IconProps) {
  const iconName =
    name.includes(':') ? name : name === 'github' ? 'simple-icons:github' : `lucide:${name}`
  return (
    <AstroIcon
      name={iconName}
      size={size}
      class={`${className} ${spin || name === 'loading' ? 'animate-spin' : ''}`}
      aria-hidden="true"
    />
  )
}
