/**
 * 把模型常见的「伪 LaTeX 定界」转成 Vditor/KaTeX 能渲染的 $ / $$。
 * 典型坏例：单独一行的 [ ... ]（本意常是 \[...\]，JSON 里反斜杠丢了）
 */
export function normalizeMathMarkdown(input: string): string {
  let md = input

  // \[ ... \] / \( ... \)
  md = md.replace(/\\\[([\s\S]*?)\\\]/g, (_, body: string) => `$$${body.trim()}$$`)
  md = md.replace(/\\\(([\s\S]*?)\\\)/g, (_, body: string) => `$${body.trim()}$`)

  // 多行块：\n[\n  formula  \n]\n
  md = md.replace(
    /(^|\n)\s*\[\s*\n([\s\S]*?)\n\s*\]\s*(?=\n|$)/g,
    (full, lead: string, body: string) => {
      const t = body.trim()
      if (!looksLikeLatex(t)) return full
      return `${lead}$$\n${t}\n$$`
    },
  )

  // 单行：[ I = \frac{...} ]
  md = md.replace(/(^|\n)\s*\[\s*([^\n[\]]+?)\s*\]\s*(?=\n|$)/g, (full, lead: string, body: string) => {
    const t = body.trim()
    if (!looksLikeLatex(t)) return full
    return `${lead}$$\n${t}\n$$`
  })

  return md
}

function looksLikeLatex(text: string): boolean {
  if (!text) return false
  if (/\\[a-zA-Z]+/.test(text)) return true
  if (/[_^]/.test(text) && /[=+]/.test(text)) return true
  if (/\\frac|\\sin|\\cos|\\tan|\\theta|\\Omega|\\times|\\text|\\mathrm|\\left|\\right/.test(text))
    return true
  // 形如 B = 0.8 且含希腊/单位痕迹
  if (/[=≈]/.test(text) && /\\/.test(text)) return true
  return false
}
