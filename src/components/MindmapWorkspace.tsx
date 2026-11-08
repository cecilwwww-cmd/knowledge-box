import { useMemo, useState } from 'react'
import type { SourceItem } from '../db/types'
import { MindmapEditor } from './MindmapEditor'
import { SourcePreview } from './SourcePreview'

interface Props {
  nodeId: string
  data: unknown
  sources: SourceItem[]
  onChange: (data: unknown) => void
}

const kindLabel: Record<string, string> = {
  image: '图',
  pdf: 'PDF',
  word: 'Word',
  html: 'HTML',
  text: '文',
  unknown: '文件',
}

export function MindmapWorkspace({ nodeId, data, sources, onChange }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  /** true = 导图在左；false = 原料在左 */
  const [mindFirst, setMindFirst] = useState(true)

  const openSource = useMemo(
    () => sources.find((s) => s.id === openId) ?? null,
    [sources, openId],
  )

  const linkable = sources.filter(
    (s) =>
      s.kind === 'image' ||
      s.kind === 'pdf' ||
      s.kind === 'word' ||
      s.kind === 'html' ||
      s.kind === 'text' ||
      !!s.dataUrl,
  )

  return (
    <div className="mind-workspace">
      {linkable.length ? (
        <div className="mind-source-links">
          <span className="mind-source-label">原料链接</span>
          {linkable.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`mind-source-chip ${openId === s.id ? 'active' : ''}`}
              title={s.name}
              onClick={() =>
                setOpenId((id) => (id === s.id ? null : s.id))
              }
            >
              [{kindLabel[s.kind || 'unknown'] || '文件'}] {s.name}
            </button>
          ))}
          {openSource ? (
            <>
              <button
                type="button"
                className="mind-source-chip ghost"
                onClick={() => setMindFirst((v) => !v)}
              >
                对调左右
              </button>
              <button
                type="button"
                className="mind-source-chip ghost"
                onClick={() => setOpenId(null)}
              >
                关闭预览
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div
        className={`mind-split ${openSource ? 'is-split' : ''} ${
          openSource && !mindFirst ? 'is-swapped' : ''
        }`}
      >
        <div className="mind-split-pane pane-mind">
          <MindmapEditor
            key={nodeId}
            data={data}
            onChange={onChange}
          />
        </div>
        {openSource ? (
          <div className="mind-split-pane pane-source">
            <SourcePreview source={openSource} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
