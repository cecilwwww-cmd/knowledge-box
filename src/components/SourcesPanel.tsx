import type { SourceItem } from '../db/types'

interface Props {
  sources: SourceItem[]
  onRemove: (id: string) => void
}

export function SourcesPanel({ sources, onRemove }: Props) {
  if (!sources.length) {
    return (
      <div className="empty-panel">
        还没有原料。把文件拖到上方「拖入图文」区域，或点击该区域选择文件。
      </div>
    )
  }

  return (
    <div className="sources-panel">
      {sources.map((s) => (
        <article key={s.id} className="source-card">
          <header>
            <strong>{s.name}</strong>
            <button type="button" onClick={() => onRemove(s.id)}>
              移除
            </button>
          </header>
          <pre>{s.textContent.slice(0, 1200)}{s.textContent.length > 1200 ? '…' : ''}</pre>
        </article>
      ))}
    </div>
  )
}
