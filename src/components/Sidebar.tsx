import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { TreeNode } from '../hooks/useKnowledgeStore'

/** 菜单相对标题可见文字末尾的间距 */
const HOVER_MENU_GAP = 8

let measureCanvas: HTMLCanvasElement | null = null

function measureTextWidth(el: HTMLElement, text: string) {
  const style = window.getComputedStyle(el)
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return 0
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  return ctx.measureText(text).width
}

/** 标题按钮很宽时，菜单应贴在「最后一个可见字 / 省略号」右侧，而不是贴在按钮右边缘 */
function getTitleVisualRight(titleEl: HTMLElement) {
  const rect = titleEl.getBoundingClientRect()
  const style = window.getComputedStyle(titleEl)
  const padL = Number.parseFloat(style.paddingLeft) || 0
  const padR = Number.parseFloat(style.paddingRight) || 0
  const text = (titleEl.textContent || '').trim()
  const available = Math.max(0, titleEl.clientWidth - padL - padR)
  const textWidth = measureTextWidth(titleEl, text)
  const visibleWidth = Math.min(textWidth, available)
  return rect.left + padL + visibleWidth
}

interface Props {
  collapsed?: boolean
  onToggleCollapse?: () => void
  tree: TreeNode[]
  selectedId: string | null
  onSelect: (id: string, tab?: 'mindmap' | 'detail') => void
  onAdd: (parentId: string | null) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onDeleteChildren: (id: string) => void
  onCancelRollup: (id: string) => void
  onOpenSettings: () => void
  onExport: () => void
  classifyMode: boolean
  checkedIds: string[]
  onToggleClassifyMode: () => void
  onToggleChecked: (id: string) => void
  onClearChecked: () => void
  onStartRollup: (opts: {
    titleMode: 'ai' | 'manual'
    manualTitle?: string
  }) => void
  rollupBusy?: boolean
  onOpenVault: (rootId: string) => void
}

interface ContextMenuState {
  nodeId: string
  title: string
  hasChildren: boolean
  isRollup: boolean
  x: number
  y: number
}

interface HoverFlyoutState {
  nodeId: string
  title: string
  top: number
  left: number
}

export function Sidebar(props: Props) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [flyout, setFlyout] = useState<HoverFlyoutState | null>(null)
  const [flyoutVisible, setFlyoutVisible] = useState(false)
  const [titleMode, setTitleMode] = useState<'ai' | 'manual'>('ai')
  const [manualTitle, setManualTitle] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const leaveTimer = useRef<number | null>(null)
  const hideTimer = useRef<number | null>(null)

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

  useEffect(
    () => () => {
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    },
    [],
  )

  const clearLeaveTimer = () => {
    if (leaveTimer.current) {
      window.clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }

  const showFlyout = (next: HoverFlyoutState) => {
    clearLeaveTimer()
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
    // 先关掉再打开，切换节点时也会重播入场动效
    setFlyoutVisible(false)
    setFlyout(next)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFlyoutVisible(true))
    })
  }

  const scheduleHideFlyout = () => {
    clearLeaveTimer()
    leaveTimer.current = window.setTimeout(() => {
      setFlyoutVisible(false)
      hideTimer.current = window.setTimeout(() => setFlyout(null), 200)
    }, 80)
  }

  const openMenu = (node: TreeNode, e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    props.onSelect(node.id)
    setFlyout(null)
    setFlyoutVisible(false)

    const pad = 8
    const approxW = 200
    const approxH = 260
    const x = Math.min(e.clientX, window.innerWidth - approxW - pad)
    const y = Math.min(e.clientY, window.innerHeight - approxH - pad)
    setMenu({
      nodeId: node.id,
      title: node.title,
      hasChildren: node.children.length > 0,
      isRollup: node.origin === 'rollup',
      x,
      y,
    })
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
            <button
              type="button"
              title="归类：勾选节点后生成上级"
              className={props.classifyMode ? 'active-tool' : ''}
              onClick={props.onToggleClassifyMode}
            >
              归
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
    <aside className={`sidebar ${props.classifyMode ? 'classify-on' : ''}`}>
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
      {props.classifyMode ? (
        <div className="classify-banner">
          归类模式：勾选要收拢的节点（≥2），再生成上级
        </div>
      ) : null}
      <div className="tree" onContextMenu={(e) => e.preventDefault()}>
        {props.tree.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            depth={0}
            selectedId={props.selectedId}
            hoverId={flyout?.nodeId ?? null}
            renamingId={renamingId}
            setRenamingId={setRenamingId}
            onSelect={props.onSelect}
            onAdd={props.onAdd}
            onRename={props.onRename}
            onDelete={props.onDelete}
            onContextMenu={openMenu}
            classifyMode={props.classifyMode}
            checked={props.checkedIds.includes(node.id)}
            checkedIds={props.checkedIds}
            onToggleChecked={props.onToggleChecked}
            onHoverRow={(payload) => {
              if (!payload) {
                scheduleHideFlyout()
                return
              }
              showFlyout(payload)
            }}
          />
        ))}
      </div>
      {props.classifyMode ? (
        <div className="classify-bar">
          <div className="classify-title-opts">
            <label className={titleMode === 'ai' ? 'on' : ''}>
              <input
                type="radio"
                name="rollup-title-mode"
                checked={titleMode === 'ai'}
                onChange={() => setTitleMode('ai')}
              />
              AI 总结标题
            </label>
            <label className={titleMode === 'manual' ? 'on' : ''}>
              <input
                type="radio"
                name="rollup-title-mode"
                checked={titleMode === 'manual'}
                onChange={() => setTitleMode('manual')}
              />
              自己命名
            </label>
          </div>
          {titleMode === 'manual' ? (
            <input
              className="classify-title-input"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="输入上级节点标题"
            />
          ) : null}
          <div className="classify-bar-actions">
            <span>已选 {props.checkedIds.length}</span>
            <button type="button" onClick={props.onClearChecked}>
              清空
            </button>
            <button
              type="button"
              className="primary"
              disabled={
                props.checkedIds.length < 2 ||
                props.rollupBusy ||
                (titleMode === 'manual' && !manualTitle.trim())
              }
              onClick={() =>
                props.onStartRollup({
                  titleMode,
                  manualTitle: manualTitle.trim(),
                })
              }
            >
              {props.rollupBusy ? '生成中…' : '生成上级'}
            </button>
          </div>
        </div>
      ) : null}
      <div className="sidebar-footer">
        <div className="sidebar-actions">
          <button
            type="button"
            title="归类：勾选零散节点，往上生成上级"
            className={props.classifyMode ? 'active-tool' : ''}
            onClick={props.onToggleClassifyMode}
          >
            归
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
          {props.tree.some((n) => n.id === menu.nodeId) ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                props.onOpenVault(menu.nodeId)
                setMenu(null)
              }}
            >
              查看资料目录
            </button>
          ) : null}
          <div className="context-sep" />
          {menu.hasChildren ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                if (
                  confirm(
                    `取消归类「${menu.title}」？\n将解散本级，子节点保留并回到上一层；不会删除子节点内容。`,
                  )
                ) {
                  props.onCancelRollup(menu.nodeId)
                }
                setMenu(null)
              }}
            >
              {menu.isRollup ? '取消归类' : '取消归类（解散本级）'}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (confirm(`删除「${menu.title}」下的全部子节点？当前节点会保留。`)) {
                props.onDeleteChildren(menu.nodeId)
              }
              setMenu(null)
            }}
          >
            删除全部子节点
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              if (confirm(`删除「${menu.title}」及其全部子节点？此操作不可恢复。`)) {
                props.onDelete(menu.nodeId)
              }
              setMenu(null)
            }}
          >
            删除（含全部子节点）
          </button>
        </div>
      ) : null}

      {flyout && typeof document !== 'undefined'
        ? createPortal(
            <div
              key={flyout.nodeId}
              ref={flyoutRef}
              className={`hover-menu ${flyoutVisible ? 'visible' : ''}`}
              style={{ top: flyout.top, left: flyout.left }}
              onMouseEnter={clearLeaveTimer}
              onMouseLeave={scheduleHideFlyout}
            >
              <div className="hover-quick">
                <button
                  type="button"
                  title="添加子节点"
                  onClick={() => props.onAdd(flyout.nodeId)}
                >
                  +
                </button>
                <button
                  type="button"
                  title="删除"
                  onClick={() => {
                    if (confirm(`删除「${flyout.title}」及其子节点？`)) {
                      props.onDelete(flyout.nodeId)
                    }
                    setFlyout(null)
                    setFlyoutVisible(false)
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
                  <button
                    type="button"
                    onClick={() => props.onSelect(flyout.nodeId, 'mindmap')}
                  >
                    导图
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onSelect(flyout.nodeId, 'detail')}
                  >
                    详情
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </aside>
  )
}

function TreeItem({
  node,
  depth,
  selectedId,
  hoverId,
  renamingId,
  setRenamingId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onContextMenu,
  onHoverRow,
  classifyMode,
  checked,
  checkedIds,
  onToggleChecked,
}: {
  node: TreeNode
  depth: number
  selectedId: string | null
  hoverId: string | null
  renamingId: string | null
  setRenamingId: (id: string | null) => void
  onSelect: (id: string, tab?: 'mindmap' | 'detail') => void
  onAdd: (parentId: string | null) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onContextMenu: (node: TreeNode, e: ReactMouseEvent) => void
  onHoverRow: (payload: HoverFlyoutState | null) => void
  classifyMode: boolean
  checked: boolean
  checkedIds: string[]
  onToggleChecked: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [draft, setDraft] = useState(node.title)
  const rowRef = useRef<HTMLDivElement>(null)
  const editing = renamingId === node.id
  const hasChildren = node.children.length > 0
  const isHover = hoverId === node.id

  useEffect(() => {
    if (editing) setDraft(node.title)
  }, [editing, node.title])

  const emitHover = () => {
    const row = rowRef.current
    if (!row || editing) return
    const titleEl =
      (row.querySelector('.tree-title') as HTMLElement | null) ||
      (row.querySelector('.tree-rename') as HTMLElement | null)
    const rowRect = row.getBoundingClientRect()
    const left = titleEl
      ? getTitleVisualRight(titleEl) + HOVER_MENU_GAP
      : rowRect.right + HOVER_MENU_GAP
    onHoverRow({
      nodeId: node.id,
      title: node.title,
      top: rowRect.top + rowRect.height / 2,
      left,
    })
  }

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
        ref={rowRef}
        className={`tree-row ${selectedId === node.id ? 'active' : ''} ${isHover ? 'is-hover' : ''} ${checked ? 'checked' : ''}`}
        onMouseEnter={emitHover}
        onMouseLeave={() => onHoverRow(null)}
        onContextMenu={(e) => onContextMenu(node, e)}
      >
        {classifyMode ? (
          <input
            type="checkbox"
            className="tree-check"
            checked={checked}
            onChange={() => onToggleChecked(node.id)}
            onClick={(e) => e.stopPropagation()}
            title="勾选以归类"
          />
        ) : null}
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
      </div>

      {expanded && hasChildren ? (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              hoverId={hoverId}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
              onSelect={onSelect}
              onAdd={onAdd}
              onRename={onRename}
              onDelete={onDelete}
              onContextMenu={onContextMenu}
              classifyMode={classifyMode}
              checked={checkedIds.includes(child.id)}
              checkedIds={checkedIds}
              onToggleChecked={onToggleChecked}
              onHoverRow={onHoverRow}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
