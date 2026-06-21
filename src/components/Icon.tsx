/** @jsxImportSource react */
/**
 * Icon 组件（React 版本）
 * 用途：在 React 岛里（如 AISummary、PostAIAssistant、PostListFilter）使用
 */
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Eraser,
  FileSearch,
  FileText,
  Hash,
  Home,
  Link2,
  List,
  Loader2,
  Menu,
  Pencil,
  RefreshCw,
  Rss,
  Search,
  Send,
  Map as Sitemap,
  Square,
  Sun,
  Tag,
  Tags,
  X,
  type LucideIcon,
} from 'lucide-react'

const icons: Record<string, LucideIcon> = {
  'alert-circle': AlertCircle,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'book-open': BookOpen,
  bot: Bot,
  calendar: Calendar,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  clock: Clock,
  copy: Copy,
  'delete-sweep': Eraser,
  'file-document-multiple': FileText,
  'file-search': FileSearch,
  'file-search-outline': FileSearch,
  'text-search': FileSearch,
  'format-list-bulleted': List,
  home: Home,
  'link-variant': Link2,
  loading: Loader2,
  menu: Menu,
  moon: Sun,
  pencil: Pencil,
  refresh: RefreshCw,
  rss: Rss,
  search: Search,
  send: Send,
  sitemap: Sitemap,
  stop: Square,
  sun: Sun,
  'tag-multiple': Tags,
  tag: Tag,
  text: FileText,
  counter: Hash,
  x: X,
  close: X,
}

export type IconName = keyof typeof icons

export interface IconProps {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  /** 用作动画图标（如 loading） */
  spin?: boolean
}

export default function Icon({
  name,
  size = 18,
  strokeWidth = 2,
  className = '',
  spin = false,
}: IconProps) {
  const Component = icons[name]
  if (!Component) return null
  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      className={`${className} ${spin || name === 'loading' ? 'animate-spin' : ''}`}
      aria-hidden="true"
    />
  )
}
