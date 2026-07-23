/**
 * 将 Obsidian wikilink [[page]] / [[page|alias]] 转为标准 Markdown 链接
 * 路径中的空格保持不变（Obsidian 允许路径含空格）
 */
import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'

const WIKILINK_RE = /^\[\[([^\]|#]+?)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]$/

export function remarkObsidianLinks() {
  return (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined) return

      const match = WIKILINK_RE.exec(node.value)
      if (!match) return

      const [, target, heading, alias] = match
      // 去掉 .md 扩展名，保留路径
      const cleanTarget = target.replace(/\.md$/, '')
      const display = alias || heading || target.replace(/\.md$/, '').split('/').pop() || target

      let href = `/notes/${cleanTarget}`
      if (heading) {
        href += `#${heading.toLowerCase().replace(/\s+/g, '-')}`
      }

      // 替换为 link 节点
      parent.children.splice(index, 1, {
        type: 'link',
        url: href,
        title: null,
        children: [{ type: 'text', value: display }],
      })
    })
  }
}
