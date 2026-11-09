/**
 * 保证详情 Markdown 以一级标题开头，且内容等于节点标题。
 * - 去掉文首已有的 # 标题（避免「有时有有时没有 / 标题不一致」）
 * - 再写入 `# {title}`
 */
export function ensureLeadingH1(markdown: string, title: string): string {
  const heading = (title || '未命名').trim() || '未命名'
  let body = (markdown || '').replace(/^\uFEFF/, '').trimStart()

  // 连续吃掉文首一级标题（含空行）
  while (true) {
    const m = body.match(/^#\s+[^\n]*\n*/)
    if (!m) break
    body = body.slice(m[0].length).trimStart()
  }

  if (!body) return `# ${heading}\n`
  return `# ${heading}\n\n${body}`
}
