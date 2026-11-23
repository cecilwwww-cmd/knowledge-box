import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AssistantPanel } from './components/AssistantPanel'
import { DetailEditor } from './components/detail'
import { MindmapWorkspace } from './components/MindmapWorkspace'
import { PaneDivider } from './components/PaneDivider'
import { PreviewModal } from './components/PreviewModal'
import { readSidebarWidth, ResizeHandle } from './components/ResizeHandle'
import { SettingsModal } from './components/SettingsModal'
import { Sidebar } from './components/Sidebar'
import { SourcesPanel } from './components/SourcesPanel'
import { UiIcon } from './components/UiIcon'
import { VaultBrowserModal } from './components/VaultBrowserModal'
import { db } from './db/database'
import { useKnowledgeStore } from './hooks/useKnowledgeStore'
import { runWorkflowStep, type WorkflowStep } from './lib/workflowTrace'
import { writeAgentChanges, type AgentPreview, type AgentScope } from './lib/agentChanges'
import { runKnowledgeAgent } from './lib/knowledgeAgent'
import {
  filesFromClipboard,
  isEditablePasteTarget,
} from './lib/clipboardFiles'

const COLLAPSE_KEY = 'knowledge-box-sidebar-collapsed'
const COLLAPSED_WIDTH = 44

export default function App() {
  const store = useKnowledgeStore()
  const [sidebarWidth, setSidebarWidth] = useState(() => readSidebarWidth())
  const [assistantWidth, setAssistantWidth] = useState(() => readSidebarWidth(340, 'right'))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  )
  const [assistantClosed, setAssistantClosed] = useState(() => {
    const saved = localStorage.getItem('knowledge-box-assistant-closed')
    return saved === null ? window.matchMedia('(max-width: 1119px)').matches : saved === '1'
  })
  const [vaultRootId, setVaultRootId] = useState<string | null>(null)
  const [copiedPath, setCopiedPath] = useState('')
  const [wideSource, setWideSource] = useState(false)
  const [notePercent, setNotePercent] = useState(52)
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [command, setCommand] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const [agentScope, setAgentScope] = useState<AgentScope>('current')
  const [agentPlan, setAgentPlan] = useState<AgentPreview | null>(null)
  const [agentNote, setAgentNote] = useState('')
  const recentAnswer = useRef<{ rootId: string; scope: AgentScope; command: string; reply: string } | undefined>(undefined)
  const undoable = useLiveQuery(async () => (await db.agentBatches.count()) > 0, [], false)
  const working = useRef(false)

  const report = (step: WorkflowStep) => setSteps((current) => {
    const next = current.slice()
    const index = next.findIndex(({ id }) => id === step.id)
    if (index < 0) next.push(step)
    else next[index] = step
    return next
  })

  const runRollup = async (options: { titleMode: 'ai' | 'manual'; manualTitle?: string }) => {
    if (working.current || store.parsing || store.preview || agentPlan) return
    working.current = true
    setSteps([])
    setCommand(store.prompt.trim() || '归类勾选节点')
    setAgentNote('')
    setAssistantClosed(false)
    try {
      await store.startRollup(options, report)
    } finally {
      working.current = false
    }
  }

  const runAgent = async () => {
    const rootId = store.selectedId
    const request = store.prompt.trim()
    if (!rootId || !request || working.current || store.organizing || store.parsing || store.preview || agentPlan) return
    working.current = true
    setApplying(true)
    setSteps([])
    setAgentNote('')
    setCommand(request)
    store.setError(null)
    const recent = recentAnswer.current
    try {
      const result = await runKnowledgeAgent({
        rootId, scope: agentScope, command: request, settings: store.settings, report,
        previous: recent?.rootId === rootId && recent.scope === agentScope ? recent : undefined,
      })
      store.setPrompt('')
      setAgentNote(result.note)
      setAgentPlan(result.preview ?? null)
      recentAnswer.current = result.preview ? undefined
        : { rootId, scope: agentScope, command: request, reply: result.note }
      if (result.preview) report({ id: 'review', label: '等待确认方案', state: 'waiting' })
    } catch (error) {
      report({ id: 'result', label: '助手任务未完成', state: 'failed' })
      setAgentNote(error instanceof Error ? error.message : '助手任务失败。')
    } finally {
      working.current = false
      setApplying(false)
    }
  }

  const applyAgent = async (undo: boolean) => {
    if (working.current || (!undo && !agentPlan) || (undo && agentPlan)) return
    working.current = true
    setApplying(true)
    try {
      await runWorkflowStep(report, undo ? 'undo' : 'write', undo ? '撤销上次操作' : '写入知识库',
        () => writeAgentChanges(undo ? undefined : agentPlan!))
      if (!undo) report({ id: 'review', label: '确认方案', state: 'done' })
      if (undo && store.selectedId && !(await db.nodes.get(store.selectedId))) {
        const first = await db.nodes.orderBy('sort').first()
        if (first) store.selectNode(first.id, 'detail')
      }
      setAgentPlan(null)
      setAgentNote(undo ? '已撤销上次操作。' : '已应用全部改动。')
    } catch (error) {
      setAgentNote(error instanceof Error ? error.message : '无法写入知识库。')
    } finally {
      working.current = false
      setApplying(false)
    }
  }

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    localStorage.setItem(
      'knowledge-box-assistant-closed',
      assistantClosed ? '1' : '0',
    )
  }, [assistantClosed])

  // 整理条展开时：在非输入框处 Ctrl+V 可粘贴截图/文字进原料
  useEffect(() => {
    if (assistantClosed || !store.selectedId) return
    const onPaste = (e: ClipboardEvent) => {
      if (isEditablePasteTarget(e.target)) return
      const files = filesFromClipboard(e.clipboardData)
      if (!files.length) return
      e.preventDefault()
      void store.addFiles(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [assistantClosed, store.selectedId, store.addFiles])

  if (!store.ready) {
    return <div className="boot">正在打开本地知识箱…</div>
  }

  const path = store.selected ? buildPath(store.nodes, store.selected.id) : []
  const pathText = path.join(' / ')
  const showingSource = store.activeTab === 'sources'
  const showingMap = store.activeTab === 'mindmap'

  const columnWidth = sidebarCollapsed ? COLLAPSED_WIDTH : sidebarWidth

  return (
    <div
      className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      style={{
        '--library-width': `${columnWidth}px`,
        '--library-handle': sidebarCollapsed ? '0px' : '6px',
        '--assistant-width': `${assistantWidth}px`,
      } as CSSProperties}
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
        onDeleteChildren={(id) => void store.deleteChildNodes(id)}
        onCancelRollup={(id) => void store.cancelRollup(id)}
        onOpenSettings={() => store.setShowSettings(true)}
        onExport={() => void store.exportBackup()}
        onImport={(file) => void store.restoreBackup(file)}
        classifyMode={store.classifyMode}
        checkedIds={store.checkedIds}
        onToggleClassifyMode={store.toggleClassifyMode}
        onToggleChecked={store.toggleChecked}
        onClearChecked={store.clearChecked}
        onStartRollup={(opts) => void runRollup(opts)}
        rollupBusy={store.organizing || store.parsing || applying || !!store.preview || !!agentPlan}
        onOpenVault={(rootId) => setVaultRootId(rootId)}
      />

      {sidebarCollapsed ? (
        <div className="resize-handle disabled" aria-hidden="true" />
      ) : (
        <ResizeHandle width={sidebarWidth} onChange={setSidebarWidth} />
      )}

      <main className="workspace">
        <header className="workspace-header">
          <div className="breadcrumb-row">
            <div className="breadcrumb" title={pathText}>
              {path.slice(0, -1).map((name, i) => <span key={i}>{name}<i aria-hidden="true">/</i></span>)}
              <strong>{path.at(-1) || '未选择节点'}</strong>
            </div>
            <div className="breadcrumb-actions">
              {store.selected && (
                <div className="workspace-actions" aria-label="工作区视图">
                  <button type="button" aria-pressed={showingSource} onClick={() => {
                    if (!showingSource) setWideSource(false)
                    store.setActiveTab(showingSource ? 'detail' : 'sources')
                  }}>
                    <UiIcon name="folder" />原料{store.sources.length ? ` ${store.sources.length}` : ''}
                  </button>
                  <button type="button" aria-pressed={showingMap}
                    onClick={() => store.setActiveTab(showingMap ? 'detail' : 'mindmap')}>
                    <UiIcon name="graph" />导图
                  </button>
                </div>
              )}
              {pathText && (
                <button type="button" className="breadcrumb-copy" title="复制知识库路径" onClick={() => {
                  void navigator.clipboard.writeText(pathText).then(() => {
                    setCopiedPath(pathText)
                    window.setTimeout(() => setCopiedPath((value) => value === pathText ? '' : value), 1600)
                  }).catch(() => store.setError('无法复制知识库路径'))
                }}>
                  <UiIcon name="copy" />{copiedPath === pathText ? '已复制' : '复制'}
                </button>
              )}
              <button
                type="button"
                className="organize-toggle assistant-toggle"
                aria-label={assistantClosed ? '展开 AI 助手' : '收起 AI 助手'}
                aria-expanded={!assistantClosed}
                aria-controls="knowledge-assistant"
                title={assistantClosed ? '展开助手' : '收起助手'}
                onClick={() => setAssistantClosed((v) => !v)}
              >
                <UiIcon name="sparkle" />
                {assistantClosed && (store.preview || agentPlan) && <span className="assistant-pending" aria-label="有待确认方案" />}
              </button>
            </div>
          </div>
          {store.error ? (
            <div className="error-banner">
              {store.error}
              <button type="button" onClick={() => store.setError(null)}>
                关闭
              </button>
            </div>
          ) : null}
          {store.status ? <div className="status-banner">{store.status}</div> : null}
        </header>

        <div className={`workspace-stage ${assistantClosed ? '' : 'assistant-open'}`}>
          <div className="workspace-body">
            {!store.selected ? (
              <div className="empty-panel">在左侧选择或新建一个节点。</div>
            ) : showingMap ? (
              <MindmapWorkspace
                nodeId={store.selected.id}
                nodeTitle={store.selected.title}
                data={store.mindmap?.data}
                markdown={store.detail?.markdown ?? ''}
                sources={store.sources}
                detailTemplate={store.settings.detailTemplate}
                onChange={(data) => void store.saveMindmap(data)}
                onSaveDetail={(id, md) => void store.saveDetailFor(id, md)}
                onOpenNode={(id) => store.selectNode(id, 'detail')}
              />
            ) : (
              <div className={`reading-workspace ${showingSource && !wideSource ? 'is-comparing' : ''}`}
                style={{ '--mind-left': notePercent / 100 } as CSSProperties}>
                <div className="workspace-note" hidden={showingSource && wideSource}>
                  <DetailEditor
                    key={store.selected.id}
                    nodeId={store.selected.id}
                    markdown={store.detail?.markdown ?? ''}
                    template={store.settings.detailTemplate}
                    onChange={(md) => void store.saveDetail(md)}
                  />
                </div>
                {showingSource && (
                  <>
                    {!wideSource && <PaneDivider label="调整详情和原料的宽度" value={notePercent} onChange={setNotePercent} />}
                    <SourcesPanel
                      key={store.selected.id}
                      sources={store.sources}
                      wide={wideSource}
                      onToggleWide={() => setWideSource((value) => !value)}
                      onClose={() => store.setActiveTab('detail')}
                      onRemove={(id) => void store.removeSource(id)}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          {!assistantClosed && <ResizeHandle side="right" width={assistantWidth} onChange={setAssistantWidth} />}
          <AssistantPanel
            steps={steps}
            command={command}
            canReview={!!store.preview}
            onReview={() => setReviewOpen(true)}
            collapsed={assistantClosed}
            prompt={store.prompt}
            onPromptChange={store.setPrompt}
            onFiles={(files) => void store.addFiles(files)}
            onOrganize={() => void runAgent()}
            organizing={store.organizing || store.parsing || applying}
            disabled={!store.selected || !!store.preview || !!agentPlan}
            scope={agentScope}
            onScopeChange={setAgentScope}
            note={agentNote}
            plan={agentPlan}
            busy={applying || store.organizing}
            onApply={() => void applyAgent(false)}
            onDiscard={() => {
              setAgentPlan(null)
              setAgentNote('')
              report({ id: 'review', label: '确认方案', state: 'skipped' })
            }}
            undoable={undoable}
            onUndo={() => void applyAgent(true)}
          />
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

      {store.preview && reviewOpen ? (
        <PreviewModal
          preview={store.preview.preview}
          mode={store.preview.mode}
          nodeTitle={store.preview.nodeTitle}
          onCancel={() => {
            if (working.current) return
            store.setPreview(null)
            setReviewOpen(false)
            report({ id: 'review', label: '确认方案', state: 'skipped' })
          }}
          onApply={(opts) => {
            if (working.current) return
            working.current = true
            setApplying(true)
            report({ id: 'review', label: '确认方案', state: 'done' })
            void runWorkflowStep(report, 'write', '写入知识库', () => store.applyPreview(opts))
              .then(() => setReviewOpen(false))
              .catch((error: unknown) => {
                store.setError(error instanceof Error ? error.message : '写入知识库失败。')
                setReviewOpen(false)
              })
              .finally(() => { working.current = false; setApplying(false) })
          }}
        />
      ) : null}

      {vaultRootId ? (
        <VaultBrowserModal
          rootId={vaultRootId}
          onClose={() => setVaultRootId(null)}
          onOpenNode={(id, tab) => {
            if (tab === 'sources') {
              store.selectNode(id)
              store.setActiveTab('sources')
            } else if (tab) {
              store.selectNode(id, tab)
            } else {
              store.selectNode(id)
            }
            setVaultRootId(null)
          }}
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
