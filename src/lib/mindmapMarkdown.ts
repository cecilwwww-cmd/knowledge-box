import katex from 'katex'
import 'katex/dist/katex.min.css'

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderTex(tex: string, displayMode: boolean) {
  try {
    return katex.renderToString(tex, {
      throwOnError: false,
      displayMode,
      strict: 'ignore',
    })
  } catch {
    return `<code>${escapeHtml(tex)}</code>`
  }
}

/**
 * Mind Elixir markdown 钩子：把节点里的 $...$ / $$...$$ 渲成 KaTeX，其余当纯文本。
 */
export function renderMindmapTopicMarkdown(raw: string): string {
  if (!raw) return ''
  let i = 0
  let html = ''
  while (i < raw.length) {
    if (raw.startsWith('$$', i)) {
      const end = raw.indexOf('$$', i + 2)
      if (end >= 0) {
        html += renderTex(raw.slice(i + 2, end), true)
        i = end + 2
        continue
      }
    }
    if (raw[i] === '$') {
      const end = raw.indexOf('$', i + 1)
      if (end > i + 1) {
        html += renderTex(raw.slice(i + 1, end), false)
        i = end + 1
        continue
      }
    }
    // 连续普通字符到下一个 $ 或结尾
    let j = i + 1
    while (j < raw.length && raw[j] !== '$') j += 1
    html += escapeHtml(raw.slice(i, j))
    i = j
  }
  return html
}
