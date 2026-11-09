/** Vditor 工具栏与预览公共配置，后续加按钮只改这里 */
export const VDITOR_TOOLBAR = [
  'headings',
  'bold',
  'italic',
  'strike',
  '|',
  'list',
  'ordered-list',
  'check',
  '|',
  'quote',
  'code',
  'inline-code',
  'link',
  'table',
  '|',
  'undo',
  'redo',
  '|',
  'fullscreen',
] as const

export const VDITOR_PLACEHOLDER =
  '直接写 Markdown；教材风用「## 1.1 标题」；学术风用「## 一、标题」；公式 $行内$ / $$独立$$'

export const VDITOR_PREVIEW = {
  math: { engine: 'KaTeX' as const, inlineDigit: true },
  markdown: { toc: false },
}
