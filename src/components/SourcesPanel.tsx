import { useState } from 'react'
import type { SourceItem } from '../db/types'
import { sourceFile, sourceKind } from '../lib/sourceFile'
import { SourcePreview } from './SourcePreview'

interface Props {
  sources: SourceItem[]
  onRemove: (id: string) => void
}

const kindLabel: Record<string, string> = {
  text: '文本',
  html: 'HTML',
  pdf: 'PDF',
  word: 'Word',
  image: '原图待识图',
  unknown: '其他',
}

export function SourcesPanel({ sources, onRemove }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (!sources.length) {
    return (
      <div className="empty-panel">
        还没有原料。支持拖入：文本 / HTML / PDF / Word(.docx) / 图片。
        图片请再点「开始整理」，由 deepseek-flash 看原图理解示意图。
      </div>
    )
  }

  const hasImage = sources.some((s) => s.kind === 'image' && s.dataUrl)

  return (
    <div className="sources-panel">
      {hasImage ? (
        <div className="source-vision-hint">
          上方预览里的文字是<strong>本地 OCR</strong>（只抽字、常有错，也看不懂示意图）。
          请确认设置模型为 <code>deepseek-flash</code> 并勾选「发送原图」，再点
          <strong>开始整理</strong>——示意图理解出现在整理预览的导图/详情里，不在这里。
        </div>
      ) : null}
      {sources.map((s) => {
        const kind = sourceKind(s)
        const file = sourceFile(s)
        const open = openId === s.id
        return (
          <article key={s.id} className="source-card">
            <header>
              <strong>
                {s.name}
                <span className="source-kind"> · {kindLabel[kind]}</span>
              </strong>
              <div className="source-card-actions">
                <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : s.id)}>
                  {open ? '收起预览' : '查看原料'}
                </button>
                <button type="button" onClick={() => onRemove(s.id)}>移除</button>
              </div>
            </header>
            {open ? <SourcePreview source={s} /> : kind === 'image' && file?.startsWith('data:image/') ? (
              <img className="source-thumb" src={file} alt={s.name} />
            ) : null}
            {kind === 'image' && (
              <details className="ocr-details">
                <summary>本地 OCR 文本（仅兜底，可忽略）</summary>
                <pre>{s.textContent}</pre>
              </details>
            )}
          </article>
        )
      })}
    </div>
  )
}
