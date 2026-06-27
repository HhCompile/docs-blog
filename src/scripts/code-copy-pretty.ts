/**
 * 为 rehype-pretty-code 渲染的代码块注入复制按钮
 * - 仅作用于 figure[data-rehype-pretty-code-figure]
 * - 与 src/scripts/code-copy.ts 区分：那个针对原始 <pre>，这个针对 pretty-code 包装的
 * - 零依赖，复用 navigator.clipboard
 */

function initPrettyCopy() {
  // rehype-pretty-code 输出的 figure 元素
  const figures = document.querySelectorAll<HTMLElement>(
    'figure[data-rehype-pretty-code-figure]'
  )
  figures.forEach((figure) => {
    if (figure.querySelector('.pretty-copy-btn')) return // 已注入

    const pre = figure.querySelector('pre')
    if (!pre) return

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'pretty-copy-btn'
    btn.setAttribute('aria-label', '复制代码')
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
      </svg>
      <span>Copy</span>
    `

    btn.addEventListener('click', async () => {
      // 提取纯文本（去掉 Shiki 的 span 装饰）
      const code = pre.querySelector('code')
      const text = code?.textContent ?? pre.textContent ?? ''
      try {
        await navigator.clipboard.writeText(text)
        const label = btn.querySelector('span')
        const orig = label?.textContent ?? 'Copy'
        if (label) label.textContent = '已复制'
        btn.classList.add('copied')
        setTimeout(() => {
          if (label) label.textContent = orig
          btn.classList.remove('copied')
        }, 1500)
      } catch {
        // 降级：选中文本
        const range = document.createRange()
        range.selectNodeContents(pre)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    })

    // 定位：放在 figure 右上角
    figure.style.position = 'relative'
    figure.appendChild(btn)
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPrettyCopy)
} else {
  initPrettyCopy()
}

// 监听 Astro View Transitions 页面切换
document.addEventListener('astro:after-swap', initPrettyCopy)
