import { useState } from 'react'
import type { OrganizePreview } from '../db/types'

interface Props {
  preview: OrganizePreview
  onCancel: () => void
  onApply: (opts: { mindmap: boolean; detail: boolean; children: boolean }) => void
}

export function PreviewModal({ preview, onCancel, onApply }: Props) {
  const [mindmap, setMindmap] = useState(true)
  const [detail, setDetail] = useState(true)
  const [children, setChildren] = useState(
    Boolean(preview.suggestedChildren?.length),
  )

  return (
    <div className="modal-backdrop">
      <div className="modal preview-modal">
        <header>
          <h2>整理预览</h2>
          <p>确认后再写入。写入前会自动保存当前版本快照。</p>
        </header>

        <div className="preview-grid">
          <section>
            <h3>思维导图结构</h3>
            <pre className="preview-tree">{renderTree(preview.mindmap)}</pre>
          </section>
          <section>
            <h3>详细内容</h3>
            <pre className="preview-md">{preview.markdown}</pre>
          </section>
        </div>

        {preview.suggestedChildren?.length ? (
          <p className="hint">
            建议子节点：{preview.suggestedChildren.join('、')}
          </p>
        ) : null}

        <div className="checks">
          <label>
            <input
              type="checkbox"
              checked={mindmap}
              onChange={(e) => setMindmap(e.target.checked)}
            />
            写入思维导图
          </label>
          <label>
            <input
              type="checkbox"
              checked={detail}
              onChange={(e) => setDetail(e.target.checked)}
            />
            写入详细内容
          </label>
          {preview.suggestedChildren?.length ? (
            <label>
              <input
                type="checkbox"
                checked={children}
                onChange={(e) => setChildren(e.target.checked)}
              />
              创建建议子节点
            </label>
          ) : null}
        </div>

        <footer>
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="primary"
            disabled={!mindmap && !detail && !children}
            onClick={() => onApply({ mindmap, detail, children })}
          >
            确认写入
          </button>
        </footer>
      </div>
    </div>
  )
}

function renderTree(
  node: { topic: string; children?: Array<{ topic: string; children?: unknown[] }> },
  depth = 0,
): string {
  const pad = '  '.repeat(depth)
  const kids = (node.children || [])
    .map((c) => renderTree(c as typeof node, depth + 1))
    .join('')
  return `${pad}- ${node.topic}\n${kids}`
}
