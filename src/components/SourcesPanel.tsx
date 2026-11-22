import { useState } from 'react'
import type { SourceItem } from '../db/types'
import { sourceKind } from '../lib/sourceFile'
import { SourcePreview } from './SourcePreview'

const kindLabels = {
  text: '文本', html: 'HTML', pdf: 'PDF', word: 'Word', image: '图片', unknown: '其他',
}

export function SourcesPanel({ sources, wide, onToggleWide, onClose, onRemove }: {
  sources: SourceItem[]
  wide: boolean
  onToggleWide: () => void
  onClose: () => void
  onRemove: (id: string) => void
}) {
  const [openId, setOpenId] = useState<string>()
  const ordered = sources.toSorted((a, b) => a.createdAt - b.createdAt)
  const source = ordered.find(({ id }) => id === openId) ?? ordered[0]

  return (
    <section className="sources-panel" aria-label="原料阅读器">
      <div className="sources-toolbar">
        {source ? (
          <select aria-label="选择原料" value={source.id} title={source.name}
            onChange={(event) => setOpenId(event.target.value)}>
            {ordered.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {kindLabels[sourceKind(item)]}
              </option>
            ))}
          </select>
        ) : <strong>原料</strong>}
        <button type="button" onClick={onToggleWide} aria-pressed={wide}>
          {wide ? '分栏对照' : '占满工作区'}
        </button>
        <button type="button" onClick={onClose}>关闭原料</button>
      </div>
      {source ? (
        <SourcePreview key={source.id} source={source} onRemove={() => onRemove(source.id)} />
      ) : (
        <div className="empty-panel">本节点还没有原料。可以在「整理」中选择或拖入文件。</div>
      )}
    </section>
  )
}
