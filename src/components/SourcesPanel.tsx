import type { SourceItem } from '../db/types'

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
      {sources.map((s) => (
        <article key={s.id} className="source-card">
          <header>
            <strong>
              {s.name}
              {s.kind ? (
                <span className="source-kind"> · {kindLabel[s.kind] || s.kind}</span>
              ) : null}
            </strong>
            <button type="button" onClick={() => onRemove(s.id)}>
              移除
            </button>
          </header>
          {s.dataUrl ? (
            <img className="source-thumb" src={s.dataUrl} alt={s.name} />
          ) : null}
          {s.kind === 'image' ? (
            <details className="ocr-details">
              <summary>本地 OCR 文本（仅兜底，可忽略）</summary>
              <pre>
                {s.textContent.slice(0, 1200)}
                {s.textContent.length > 1200 ? '…' : ''}
              </pre>
            </details>
          ) : (
            <pre>
              {s.textContent.slice(0, 1200)}
              {s.textContent.length > 1200 ? '…' : ''}
            </pre>
          )}
        </article>
      ))}
    </div>
  )
}
