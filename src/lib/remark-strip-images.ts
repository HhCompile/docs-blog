/**
 * 移除笔记中的图片节点（Obsidian 图片路径在 blog 上下文中不可解析）
 */
import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'

export function remarkStripImages() {
  return (tree: Root) => {
    visit(tree, 'image', (node, index, parent) => {
      if (parent && index !== undefined) {
        // 替换为 alt 文本
        const alt = node.alt || '[图片]'
        parent.children.splice(index, 1, { type: 'text', value: `📷 ${alt}` })
      }
    })
  }
}
