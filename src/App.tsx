import { useEffect, useState } from 'react'
import { DetailEditor } from './components/DetailEditor'
import { MindmapEditor } from './components/MindmapEditor'
import { OrganizeBar } from './components/OrganizeBar'
import { PreviewModal } from './components/PreviewModal'
import { readSidebarWidth, ResizeHandle } from './components/ResizeHandle'
import { SettingsModal } from './components/SettingsModal'
import { Sidebar } from './components/Sidebar'
import { SourcesPanel } from './components/SourcesPanel'
import { useKnowledgeStore } from './hooks/useKnowledgeStore'

const COLLAPSE_KEY = 'knowledge-box-sidebar-collapsed'
const COLLAPSED_WIDTH = 44

export default function App() {
  const store = useKnowledgeStore()
  const [sidebarWidth, setSidebarWidth] = useState(() => readSidebarWidth())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  )
  const [organizeCollapsed, setOrganizeCollapsed] = useState(
    () => localStorage.getItem('knowledge-box-organize-collapsed') === '1',
  )

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    localStorage.setItem(
      'knowledge-box-organize-collapsed',
      organizeCollapsed ? '1' : '0',
    )
  }, [organizeCollapsed])

  if (!store.ready) {
    return <div className="boot">正在打开本地知识箱…</div>
  }

  const path = store.selected
    ? buildPath(store.nodes, store.selected.id).join(' / ')
    : ''

  const columnWidth = sidebarCollapsed ? COLLAPSED_WIDTH : sidebarWidth

  return (
    <div
      className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      style={{
        gridTemplateColumns: sidebarCollapsed
          ? `${columnWidth}px 0 1fr`
          : `${columnWidth}px 6px 1fr`,
      }}
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        tree={store.tree}
        selectedId={store.selectedId}
        onSelect={store.selectNode}
        onAdd={(parentId) => void store.addNode(parentId)}
        onRename={(id, title) => void store.renameNode(id, title)}
        onDelete={(id) => void store.deleteNode(id)}
        onOpenSettings={() => store.setShowSettings(true)}
        onExport={() => void store.exportBackup()}
      />

      {sidebarCollapsed ? (
        <div className="resize-handle disabled" aria-hidden="true" />
      ) : (
        <ResizeHandle width={sidebarWidth} onChange={setSidebarWidth} />
      )}

      <main className="workspace">
        <header className="workspace-header">
          <div className="breadcrumb-row">
            <div className="breadcrumb">{path || '未选择节点'}</div>
            <button
              type="button"
              className="organize-toggle"
              title={organizeCollapsed ? '展开整理条' : '收起整理条'}
              onClick={() => setOrganizeCollapsed((v) => !v)}
            >
              {organizeCollapsed ? '▾ 整理' : '▴ 整理'}
            </button>
          </div>
          {store.error ? (
            <div className="error-banner">
              {store.error}
              <button type="button" onClick={() => store.setError(null)}>
                关闭
              </button>
            </div>
          ) : null}
        </header>

        {!organizeCollapsed ? (
          <OrganizeBar
            prompt={store.prompt}
            onPromptChange={store.setPrompt}
            onFiles={(files) => void store.addFiles(files)}
            onOrganize={() => void store.startOrganize()}
            organizing={store.organizing}
            disabled={!store.selected}
          />
        ) : null}

        <div className="tabs">
          {(
            [
              ['sources', '原料'],
              ['mindmap', '思维导图'],
              ['detail', '详细内容'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={store.activeTab === key ? 'active' : ''}
              onClick={() => store.setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="workspace-body">
          {!store.selected ? (
            <div className="empty-panel">在左侧选择或新建一个节点。</div>
          ) : store.activeTab === 'sources' ? (
            <SourcesPanel
              sources={store.sources}
              onRemove={(id) => void store.removeSource(id)}
            />
          ) : store.activeTab === 'mindmap' ? (
            <MindmapEditor
              key={store.selected.id}
              data={store.mindmap?.data}
              onChange={(data) => void store.saveMindmap(data)}
            />
          ) : (
            <DetailEditor
              key={store.selected.id}
              markdown={store.detail?.markdown ?? ''}
              onChange={(md) => void store.saveDetail(md)}
            />
          )}
        </div>

        <footer className="status-bar">
          <span>{store.selected?.title ?? '—'}</span>
          <span>
            原料 {store.sources.length} · 字数{' '}
            {(store.detail?.markdown ?? '').replace(/\s/g, '').length}
          </span>
        </footer>
      </main>

      {store.showSettings ? (
        <SettingsModal
          settings={store.settings}
          onSave={(s) => void store.saveSettings(s)}
          onClose={() => store.setShowSettings(false)}
        />
      ) : null}

      {store.preview ? (
        <PreviewModal
          preview={store.preview.preview}
          onCancel={() => store.setPreview(null)}
          onApply={(opts) => void store.applyPreview(opts)}
        />
      ) : null}
    </div>
  )
}

function buildPath(
  nodes: Array<{ id: string; parentId: string | null; title: string }>,
  id: string,
) {
  const map = new Map(nodes.map((n) => [n.id, n]))
  const parts: string[] = []
  let cur = map.get(id)
  while (cur) {
    parts.unshift(cur.title)
    cur = cur.parentId ? map.get(cur.parentId) : undefined
  }
  return parts
}
