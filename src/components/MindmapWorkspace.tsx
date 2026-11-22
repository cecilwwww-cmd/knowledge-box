import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { db } from '../db/database'
import type { DetailTemplateId, SourceItem } from '../db/types'
import { DetailEditor } from './detail'
import { MindmapEditor, type MindmapSelectInfo } from './MindmapEditor'
import { MindmapRelationshipGraph } from './MindmapRelationshipGraph'
import { PaneDivider } from './PaneDivider'
import { SourcePreview } from './SourcePreview'

interface Props {
  nodeId: string
  nodeTitle: string
  data: unknown
  markdown: string
  sources: SourceItem[]
  detailTemplate?: DetailTemplateId | string
  onChange: (data: unknown) => void
  onSaveDetail: (nodeId: string, markdown: string) => void
  onOpenNode?: (id: string) => void
}

const kindLabel: Record<string, string> = {
  image: '图',
  pdf: 'PDF',
  word: 'Word',
  html: 'HTML',
  text: '文',
  unknown: '文件',
}

export function MindmapWorkspace({
  nodeId,
  nodeTitle,
  data,
  markdown,
  sources,
  detailTemplate,
  onChange,
  onSaveDetail,
  onOpenNode,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  /** true = 导图在左；false = 右侧内容在左 */
  const [mindFirst, setMindFirst] = useState(true)
  const [view, setView] = useState<'graph' | 'edit'>('graph')
  const [graphPercent, setGraphPercent] = useState(50)
  /** 右侧详情：默认当前节点；点带导航的导图分支后切到对应子节点 */
  const [viewNodeId, setViewNodeId] = useState(nodeId)
  /** 进入页 / 切换详情时播一次进入动效 */
  const [enterTick, setEnterTick] = useState(0)
  /** 是否显示左右分栏；可取消为仅导图 */
  const [splitOpen, setSplitOpen] = useState(false)

  useEffect(() => {
    setViewNodeId(nodeId)
    setOpenId(null)
    setEnterTick((t) => t + 1)
    setSplitOpen(false)
  }, [nodeId])

  const viewNode = useLiveQuery(
    () => (viewNodeId !== nodeId ? db.nodes.get(viewNodeId) : undefined),
    [viewNodeId, nodeId],
  )
  const viewDetail = useLiveQuery(
    () => (viewNodeId !== nodeId ? db.details.get(viewNodeId) : undefined),
    [viewNodeId, nodeId],
  )

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

  const linkedAway = viewNodeId !== nodeId
  const paneTitle = linkedAway
    ? viewNode?.title || '联动详情'
    : nodeTitle || '本节点详情'
  const paneMarkdown = linkedAway
    ? viewDetail?.markdown ?? '（该节点暂无详细内容）'
    : markdown

  const openSplitTo = (nextId: string) => {
    setSplitOpen(true)
    setViewNodeId((prev) => {
      if (prev !== nextId) setEnterTick((t) => t + 1)
      return nextId
    })
  }

  const handleSelect = (info: MindmapSelectInfo) => {
    setOpenId(null)
    openSplitTo(info.kbNodeId || nodeId)
  }

  const leftPercent = mindFirst ? graphPercent : 100 - graphPercent
  const resizeTo = (left: number) => {
    const bounded = Math.min(76, Math.max(24, left))
    setGraphPercent(mindFirst ? bounded : 100 - bounded)
  }

  return (
    <div className="mind-workspace">
      <div className="mind-source-links">
        <button type="button" className="mind-source-chip" aria-pressed={view === 'graph'}
          onClick={() => setView('graph')}>关系图谱</button>
        <button type="button" className="mind-source-chip" aria-pressed={view === 'edit'}
          onClick={() => setView('edit')}>编辑导图</button>
        {splitOpen ? (
          <button
            type="button"
            className="mind-source-chip"
            title="只保留思维导图"
            onClick={() => {
              setSplitOpen(false)
              setOpenId(null)
            }}
          >
            取消分栏
          </button>
        ) : (
          <button
            type="button"
            className="mind-source-chip"
            title="导图 + 详情左右分栏"
            onClick={() => openSplitTo(viewNodeId)}
          >
            展开分栏
          </button>
        )}
        <button
          type="button"
          className="mind-source-chip ghost"
          disabled={!splitOpen}
          onClick={() => setMindFirst((v) => !v)}
        >
          对调左右
        </button>
        {splitOpen && linkedAway ? (
          <>
            <button
              type="button"
              className="mind-source-chip"
              onClick={() => openSplitTo(nodeId)}
            >
              回到本节点详情
            </button>
            {onOpenNode ? (
              <button
                type="button"
                className="mind-source-chip"
                onClick={() => onOpenNode(viewNodeId)}
              >
                打开「{paneTitle}」
              </button>
            ) : null}
          </>
        ) : (
          <span className="mind-source-hint">
            {splitOpen
              ? '拖动中间的分隔线可调整左右宽度'
              : view === 'graph' ? '单击图中节点打开详情' : '点击导图分支打开对应详情'}
          </span>
        )}
        {linkable.length ? (
          <>
            <span className="mind-source-label">原料</span>
            {linkable.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`mind-source-chip ${openId === s.id ? 'active' : ''}`}
                title={s.name}
                onClick={() => {
                  setOpenId((id) => {
                    const next = id === s.id ? null : s.id
                    if (next) {
                      setSplitOpen(true)
                      setEnterTick((t) => t + 1)
                    }
                    return next
                  })
                }}
              >
                [{kindLabel[s.kind || 'unknown'] || '文件'}] {s.name}
              </button>
            ))}
            {openSource ? (
              <button
                type="button"
                className="mind-source-chip ghost"
                onClick={() => setOpenId(null)}
              >
                关闭原料预览
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      <div
        style={{ '--mind-left': leftPercent / 100 } as CSSProperties}
        className={`mind-split ${splitOpen ? 'is-split' : 'is-solo'} ${
          splitOpen && !mindFirst ? 'is-swapped' : ''
        }`}
      >
        <div className="mind-split-pane pane-mind">
          <div className={`mind-pane ${splitOpen ? 'detail-pane' : ''}`}>
            {splitOpen && (
              <header className="detail-pane-head"><strong>{view === 'graph' ? '关系图谱' : '思维导图'}</strong></header>
            )}
            {view === 'graph' ? (
              <MindmapRelationshipGraph key={nodeId} nodeId={nodeId} onSelectNode={(id) => {
                setOpenId(null)
                openSplitTo(id)
              }} />
            ) : (
              <MindmapEditor key={nodeId} data={data} onChange={onChange} onSelectNode={handleSelect} />
            )}
          </div>
        </div>
        {splitOpen ? (
          <>
            <PaneDivider label="调整导图和详情的宽度" value={leftPercent} onChange={resizeTo} />
            <div className="mind-split-pane pane-detail is-visible">
              <div key={openSource?.id ?? `${viewNodeId}-${enterTick}`} className="pane-detail-inner">
                {openSource ? (
                  <SourcePreview source={openSource} />
                ) : (
                  <div className="detail-pane">
                    <header className="detail-pane-head">
                      <strong>{paneTitle}</strong>
                      {linkedAway && <span className="detail-pane-badge">联动</span>}
                    </header>
                    <DetailEditor
                      key={viewNodeId}
                      nodeId={viewNodeId}
                      markdown={paneMarkdown}
                      template={detailTemplate}
                      onChange={(md) => onSaveDetail(viewNodeId, md)}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
