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
  image: '图片（原图+OCR）',
  unknown: '其他',
}

export function SourcesPanel({ sources, onRemove }: Props) {
  if (!sources.length) {
    return (
      <div className="empty-panel">
        还没有原料。支持拖入：文本 / HTML / PDF / Word(.docx) /
        图片（原图发给识图模型；OCR 仅作兜底）。
      </div>
    )
  }

  return (
    <div className="sources-panel">
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
          <pre>
            {s.textContent.slice(0, 1200)}
            {s.textContent.length > 1200 ? '…' : ''}
          </pre>
        </article>
      ))}
    </div>
  )
}
