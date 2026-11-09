import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/database'
import type { DetailTemplateId, SourceItem } from '../db/types'
import { DetailEditor } from './detail'
import { MindmapEditor, type MindmapSelectInfo } from './MindmapEditor'
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
  /** 右侧详情：默认当前节点；点带导航的导图分支后切到对应子节点 */
  const [viewNodeId, setViewNodeId] = useState(nodeId)
  /** 进入页 / 切换详情时播一次进入动效 */
  const [enterTick, setEnterTick] = useState(0)
  /** 是否显示左右分栏；可取消为仅导图 */
  const [splitOpen, setSplitOpen] = useState(true)

  useEffect(() => {
    setViewNodeId(nodeId)
    setOpenId(null)
    setEnterTick((t) => t + 1)
    setSplitOpen(true)
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

  return (
    <div className="mind-workspace">
      <div className="mind-source-links">
        <span className="mind-source-label">分栏</span>
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
              ? '点击带「导航」标签的分支，右侧切换到对应子节点详情'
              : '已取消分栏；点「展开分栏」或导图导航分支可再打开'}
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
        className={`mind-split ${splitOpen ? 'is-split' : 'is-solo'} ${
          splitOpen && !mindFirst ? 'is-swapped' : ''
        }`}
      >
        <div className="mind-split-pane pane-mind">
          <MindmapEditor
            key={nodeId}
            data={data}
            onChange={onChange}
            onSelectNode={handleSelect}
          />
        </div>
        {splitOpen ? (
          <div className="mind-split-pane pane-detail is-visible">
            <div
              key={openSource?.id ?? `${viewNodeId}-${enterTick}`}
              className="pane-detail-inner"
            >
              {openSource ? (
                <SourcePreview source={openSource} />
              ) : (
                <div className="detail-pane">
                  <header className="detail-pane-head">
                    <strong>{paneTitle}</strong>
                    {linkedAway ? (
                      <span className="detail-pane-badge">联动</span>
                    ) : null}
                  </header>
                  <DetailEditor
                    key={viewNodeId}
                    markdown={paneMarkdown}
                    template={detailTemplate}
                    onChange={(md) => onSaveDetail(viewNodeId, md)}
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
