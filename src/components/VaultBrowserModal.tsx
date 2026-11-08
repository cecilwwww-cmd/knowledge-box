import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/database'
import type { KnowledgeNode, SourceItem } from '../db/types'

interface Props {
  rootId: string
  onClose: () => void
  onOpenNode: (id: string, tab?: 'sources' | 'mindmap' | 'detail') => void
}

type VaultEntry = {
  node: KnowledgeNode
  children: VaultEntry[]
  sources: SourceItem[]
}

function buildVault(
  nodes: KnowledgeNode[],
  sources: SourceItem[],
  rootId: string,
): VaultEntry | null {
  const root = nodes.find((n) => n.id === rootId)
  if (!root) return null
  const byParent = new Map<string | null, KnowledgeNode[]>()
  for (const n of nodes) {
    const key = n.parentId
    const list = byParent.get(key) || []
    list.push(n)
    byParent.set(key, list)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title))
  }
  const sourcesByNode = new Map<string, SourceItem[]>()
  for (const s of sources) {
    const list = sourcesByNode.get(s.nodeId) || []
    list.push(s)
    sourcesByNode.set(s.nodeId, list)
  }
  for (const list of sourcesByNode.values()) {
    list.sort((a, b) => a.createdAt - b.createdAt)
  }

  const walk = (node: KnowledgeNode): VaultEntry => {
    const kids = byParent.get(node.id) || []
    return {
      node,
      children: kids.map(walk),
      sources: sourcesByNode.get(node.id) || [],
    }
  }
  return walk(root)
}

/** 文件夹名 / 展示名：与节点标题一致；冲突时加短 id 后缀 */
function displayName(title: string, id: string, used: Set<string>) {
  let name = title.trim() || '未命名'
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const short = id.slice(0, 6)
  name = `${title.trim() || '未命名'}（${short}）`
  used.add(name)
  return name
}

export function VaultBrowserModal({ rootId, onClose, onOpenNode }: Props) {
  const nodes = useLiveQuery(() => db.nodes.toArray(), []) ?? []
  const sources = useLiveQuery(() => db.sources.toArray(), []) ?? []
  const vault = useMemo(
    () => buildVault(nodes, sources, rootId),
    [nodes, sources, rootId],
  )
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootId]))
  const [activeSource, setActiveSource] = useState<SourceItem | null>(null)

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!vault) {
    return (
      <div className="modal-backdrop">
        <div className="modal vault-modal">
          <header>
            <h2>资料目录</h2>
            <p>节点已不存在或已被删除。</p>
          </header>
          <footer>
            <button type="button" onClick={onClose}>
              关闭
            </button>
          </footer>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal vault-modal">
        <header>
          <h2>资料目录 · {vault.node.title}</h2>
          <p>
            文件夹与层级随左侧知识树实时同步；每一层名称即对应节点标题。叶子节点下是该节点上传的原料文件。
          </p>
        </header>

        <div className="vault-layout">
          <div className="vault-tree">
            <VaultFolder
              entry={vault}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              onOpenNode={onOpenNode}
              onPickSource={setActiveSource}
              activeSourceId={activeSource?.id ?? null}
              nameUsed={new Set()}
              isRoot
            />
          </div>
          <div className="vault-preview">
            {activeSource ? (
              <>
                <div className="vault-preview-head">
                  <strong>{activeSource.name}</strong>
                  <span>{activeSource.kind || activeSource.mimeType}</span>
                </div>
                {activeSource.dataUrl && activeSource.kind === 'image' ? (
                  <img src={activeSource.dataUrl} alt={activeSource.name} />
                ) : (
                  <pre>{activeSource.textContent.slice(0, 4000)}</pre>
                )}
              </>
            ) : (
              <div className="vault-preview-empty">
                展开文件夹，点击原料文件可预览。点击节点名可跳转到该笔记。
              </div>
            )}
          </div>
        </div>

        <footer>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </footer>
      </div>
    </div>
  )
}

function VaultFolder({
  entry,
  depth,
  expanded,
  onToggle,
  onOpenNode,
  onPickSource,
  activeSourceId,
  nameUsed,
  isRoot,
}: {
  entry: VaultEntry
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onOpenNode: (id: string, tab?: 'sources' | 'mindmap' | 'detail') => void
  onPickSource: (s: SourceItem) => void
  activeSourceId: string | null
  nameUsed: Set<string>
  isRoot?: boolean
}) {
  const open = expanded.has(entry.node.id)
  const folderName = displayName(entry.node.title, entry.node.id, nameUsed)
  const hasKids = entry.children.length > 0 || entry.sources.length > 0

  return (
    <div className="vault-folder" style={{ ['--depth' as string]: depth }}>
      <div className="vault-row">
        <button
          type="button"
          className="vault-twist"
          onClick={() => onToggle(entry.node.id)}
          disabled={!hasKids && !isRoot}
          aria-label="展开"
        >
          {hasKids ? (open ? '▾' : '▸') : '·'}
        </button>
        <span className={`vault-icon ${open ? 'is-open' : ''}`} aria-hidden>
          夹
        </span>
        <button
          type="button"
          className="vault-name"
          title="打开该节点"
          onClick={() => onOpenNode(entry.node.id, 'sources')}
        >
          {folderName}
        </button>
        <span className="vault-meta">
          {entry.children.length
            ? `${entry.children.length} 子夹`
            : entry.sources.length
              ? `${entry.sources.length} 文件`
              : '空'}
        </span>
      </div>

      {open ? (
        <div className="vault-children">
          {entry.children.map((child) => (
            <VaultFolder
              key={child.node.id}
              entry={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onOpenNode={onOpenNode}
              onPickSource={onPickSource}
              activeSourceId={activeSourceId}
              nameUsed={new Set()}
            />
          ))}
          {entry.sources.map((s, i) => {
            // 展示名跟节点标题走；多文件时加序号。右侧 meta 保留原始上传名
            const ext =
              s.name.includes('.')
                ? s.name.slice(s.name.lastIndexOf('.'))
                : s.kind === 'image'
                  ? '.png'
                  : '.txt'
            const label =
              entry.sources.length === 1
                ? `${folderName}${ext}`
                : `${folderName}-${i + 1}${ext}`
            return (
              <div
                key={s.id}
                className={`vault-row vault-file ${activeSourceId === s.id ? 'active' : ''}`}
                style={{ paddingLeft: 22 }}
              >
                <span className="vault-twist vault-twist-spacer" />
                <span
                  className={`vault-icon is-file ${s.kind === 'image' ? 'is-image' : ''}`}
                  aria-hidden
                >
                  件
                </span>
                <button
                  type="button"
                  className="vault-name"
                  onClick={() => onPickSource(s)}
                >
                  {label}
                </button>
                <span className="vault-meta">{s.name}</span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
