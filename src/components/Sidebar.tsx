import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { TreeNode } from '../hooks/useKnowledgeStore'

interface Props {
  collapsed?: boolean
  onToggleCollapse?: () => void
  tree: TreeNode[]
  selectedId: string | null
  onSelect: (id: string, tab?: 'mindmap' | 'detail') => void
  onAdd: (parentId: string | null) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onOpenSettings: () => void
  onExport: () => void
}

interface ContextMenuState {
  nodeId: string
  title: string
  x: number
  y: number
}

export function Sidebar(props: Props) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return

    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      close()
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [menu])

  const openMenu = (node: TreeNode, e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    props.onSelect(node.id)

    const pad = 8
    const approxW = 180
    const approxH = 220
    const x = Math.min(e.clientX, window.innerWidth - approxW - pad)
    const y = Math.min(e.clientY, window.innerHeight - approxH - pad)
    setMenu({ nodeId: node.id, title: node.title, x, y })
  }

  if (props.collapsed) {
    return (
      <aside className="sidebar sidebar--collapsed">
        <button
          type="button"
          className="collapse-toggle"
          title="展开左侧栏"
          onClick={props.onToggleCollapse}
        >
          »
        </button>
        <div className="sidebar-footer">
          <div className="sidebar-actions sidebar-actions--vertical">
            <button type="button" title="新建根节点" onClick={() => props.onAdd(null)}>
              +
            </button>
            <button type="button" title="导出备份" onClick={props.onExport}>
              ⇩
            </button>
            <button type="button" title="设置" onClick={props.onOpenSettings}>
              ⚙
            </button>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">知识箱</div>
        <button
          type="button"
          className="collapse-toggle"
          title="收起左侧栏"
          onClick={props.onToggleCollapse}
        >
          «
        </button>
      </div>
      <div className="tree" onContextMenu={(e) => e.preventDefault()}>
        {props.tree.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            depth={0}
            selectedId={props.selectedId}
            renamingId={renamingId}
            setRenamingId={setRenamingId}
            onSelect={props.onSelect}
            onAdd={props.onAdd}
            onRename={props.onRename}
            onDelete={props.onDelete}
            onContextMenu={openMenu}
          />
        ))}
      </div>
      <div className="sidebar-footer">
        <div className="sidebar-actions">
          <button type="button" title="新建根节点" onClick={() => props.onAdd(null)}>
            +
          </button>
          <button type="button" title="导出备份" onClick={props.onExport}>
            ⇩
          </button>
          <button type="button" title="设置" onClick={props.onOpenSettings}>
            ⚙
          </button>
        </div>
      </div>

      {menu ? (
        <div
          ref={menuRef}
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setRenamingId(menu.nodeId)
              setMenu(null)
            }}
          >
            重命名
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              props.onAdd(menu.nodeId)
              setMenu(null)
            }}
          >
            新建子节点
          </button>
          <div className="context-sep" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              props.onSelect(menu.nodeId, 'mindmap')
              setMenu(null)
            }}
          >
            打开思维导图
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              props.onSelect(menu.nodeId, 'detail')
              setMenu(null)
            }}
          >
            打开详细内容
          </button>
          <div className="context-sep" />
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              if (confirm(`删除「${menu.title}」及其子节点？`)) {
                props.onDelete(menu.nodeId)
              }
              setMenu(null)
            }}
          >
            删除
          </button>
        </div>
      ) : null}
    </aside>
  )
}

function TreeItem({
  node,
  depth,
  selectedId,
  renamingId,
  setRenamingId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onContextMenu,
}: {
  node: TreeNode
  depth: number
  selectedId: string | null
  renamingId: string | null
  setRenamingId: (id: string | null) => void
  onSelect: (id: string, tab?: 'mindmap' | 'detail') => void
  onAdd: (parentId: string | null) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onContextMenu: (node: TreeNode, e: ReactMouseEvent) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [hover, setHover] = useState(false)
  const [draft, setDraft] = useState(node.title)
  const editing = renamingId === node.id
  const hasChildren = node.children.length > 0

  useEffect(() => {
    if (editing) setDraft(node.title)
  }, [editing, node.title])

  const commitRename = () => {
    setRenamingId(null)
    if (draft.trim() && draft.trim() !== node.title) {
      onRename(node.id, draft.trim())
    } else {
      setDraft(node.title)
    }
  }

  return (
    <div className={`tree-item depth-${depth}`}>
      <div
        className={`tree-row ${selectedId === node.id ? 'active' : ''} ${hover ? 'is-hover' : ''}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onContextMenu={(e) => onContextMenu(node, e)}
      >
        {hasChildren ? (
          <button
            type="button"
            className="twist"
            onClick={() => setExpanded((v) => !v)}
            aria-label="展开"
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="twist twist-spacer" aria-hidden="true" />
        )}

        {editing ? (
          <input
            className="tree-rename"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                setDraft(node.title)
                setRenamingId(null)
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="tree-title"
            onClick={() => onSelect(node.id)}
            onDoubleClick={() => setRenamingId(node.id)}
          >
            {node.title}
          </button>
        )}

        {!editing && (
          <div className={`hover-menu ${hover ? 'visible' : ''}`} aria-hidden={!hover}>
            <div className="hover-quick">
              <button type="button" title="添加子节点" onClick={() => onAdd(node.id)}>
                +
              </button>
              <button
                type="button"
                title="删除"
                onClick={() => {
                  if (confirm(`删除「${node.title}」及其子节点？`)) onDelete(node.id)
                }}
              >
                ×
              </button>
            </div>
            <div className="hover-brace-group">
              <span className="hover-brace" aria-hidden="true">
                {'{'}
              </span>
              <div className="hover-brace-actions">
                <button type="button" onClick={() => onSelect(node.id, 'mindmap')}>
                  导图
                </button>
                <button type="button" onClick={() => onSelect(node.id, 'detail')}>
                  详情
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {expanded && hasChildren ? (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
              onSelect={onSelect}
              onAdd={onAdd}
              onRename={onRename}
              onDelete={onDelete}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
