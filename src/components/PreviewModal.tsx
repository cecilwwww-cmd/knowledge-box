import { useState } from 'react'
import type { OrganizePreview } from '../db/types'

interface Props {
  preview: OrganizePreview
  mode?: 'organize' | 'rollup'
  nodeTitle?: string
  onCancel: () => void
  onApply: (opts: { mindmap: boolean; detail: boolean; title?: string }) => void
}

export function PreviewModal({
  preview,
  mode = 'organize',
  nodeTitle,
  onCancel,
  onApply,
}: Props) {
  const [mindmap, setMindmap] = useState(true)
  const [detail, setDetail] = useState(true)
  const [title, setTitle] = useState(
    nodeTitle || preview.title || preview.mindmap.topic || '',
  )
  const isRollup = mode === 'rollup'

  return (
    <div className="modal-backdrop">
      <div className="modal preview-modal">
        <header>
          <h2>{isRollup ? '上级节点预览' : '整理预览'}</h2>
          <p>
            {isRollup
              ? '将创建上级节点并把勾选节点收拢为其子节点。详情为概况，导图为大块总览；标题可再改。'
              : '确认后写入导图/详情，并同步左侧目录标题。'}
          </p>
        </header>

        <label className="field">
          <span>{isRollup ? '上级标题' : '节点标题'}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isRollup ? '上级节点标题' : '本条知识标题'}
          />
        </label>

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
        </div>

        <footer>
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="primary"
            disabled={(!mindmap && !detail) || !title.trim()}
            onClick={() =>
              onApply({
                mindmap,
                detail,
                title: title.trim(),
              })
            }
          >
            {isRollup ? '确认生成上级' : '确认写入'}
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
