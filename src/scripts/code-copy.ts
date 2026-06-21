/**
 * 代码块复制按钮 - 全局脚本
 * - 监听 DOM 变化，包裹所有 <pre> 元素
 * - 零依赖，~1KB
 */

function init() {
  // 找所有未被包装的 pre
  document.querySelectorAll<HTMLPreElement>('article.prose pre, .prose pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-block-wrapper')) return
    if (pre.closest('.code-block-wrapper')) return

    const wrapper = document.createElement('div')
    wrapper.className = 'code-block-wrapper'
    pre.parentNode?.insertBefore(wrapper, pre)
    wrapper.appendChild(pre)

    const btn = document.createElement('button')
    btn.className = 'copy-btn'
    btn.type = 'button'
    btn.setAttribute('aria-label', '复制代码')
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      <span class="copy-text">复制</span>
    `

    btn.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      const code = pre.querySelector('code')?.innerText ?? pre.innerText
      try {
        await navigator.clipboard.writeText(code)
        btn.classList.add('copied')
        const text = btn.querySelector('.copy-text')!
        const orig = text.textContent
        text.textContent = '已复制'
        setTimeout(() => {
          btn.classList.remove('copied')
          text.textContent = orig
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

    wrapper.appendChild(btn)
  })
}

// 首次执行 + 监听动态插入
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init()
    // 监听 Astro 视图过渡（如有）
    const obs = new MutationObserver(() => init())
    obs.observe(document.body, { childList: true, subtree: true })
  })
} else {
  init()
  const obs = new MutationObserver(() => init())
  obs.observe(document.body, { childList: true, subtree: true })
}
