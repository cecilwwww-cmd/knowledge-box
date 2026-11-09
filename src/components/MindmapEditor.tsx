import MindElixir from 'mind-elixir'
import type { MindElixirData, NodeObj } from 'mind-elixir'
import 'mind-elixir/style.css'
import { useEffect, useRef } from 'react'
import { renderMindmapTopicMarkdown } from '../lib/mindmapMarkdown'
import { TEXTBOOK_MINDMAP_THEME } from '../lib/mindmapTheme'

export type MindmapSelectInfo = {
  kbNodeId?: string
  topic: string
  isRoot: boolean
}

interface Props {
  data: unknown
  onChange: (data: unknown) => void
  onSelectNode?: (info: MindmapSelectInfo) => void
}

type NavMeta = { kbNodeId?: string }
type TopicEl = HTMLElement & { nodeObj?: NodeObj<NavMeta> }

export function MindmapEditor({ data, onChange, onSelectNode }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<InstanceType<typeof MindElixir> | null>(null)
  const saveTimer = useRef<number | null>(null)
  const onChangeRef = useRef(onChange)
  const onSelectRef = useRef(onSelectNode)
  onChangeRef.current = onChange
  onSelectRef.current = onSelectNode

  useEffect(() => {
    if (!hostRef.current) return

    const mei = new MindElixir({
      el: hostRef.current,
      // 教材逻辑图：根在左，内容向右展开
      direction: MindElixir.RIGHT,
      editable: true,
      contextMenu: true,
      toolBar: true,
      keypress: true,
      allowUndo: true,
      alignment: 'nodes',
      theme: TEXTBOOK_MINDMAP_THEME,
      generateMainBranch: TEXTBOOK_MINDMAP_THEME.generateMainBranch,
      generateSubBranch: TEXTBOOK_MINDMAP_THEME.generateSubBranch,
      markdown: (md) => renderMindmapTopicMarkdown(md),
    })

    const initial: MindElixirData =
      data && typeof data === 'object' && data !== null && 'nodeData' in data
        ? (data as MindElixirData)
        : (MindElixir.new('新主题') as MindElixirData)

    mei.init(initial)
    instanceRef.current = mei

    const scheduleSave = () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        onChangeRef.current(mei.getData())
      }, 400)
    }

    const emitSelect = (nodes: NodeObj<NavMeta>[]) => {
      const n = nodes[0]
      if (!n) return
      onSelectRef.current?.({
        kbNodeId: n.metadata?.kbNodeId,
        topic: String(n.topic || ''),
        isRoot: !n.parent || n.id === 'root',
      })
    }

    // mind-elixir 普通点击不一定稳定触发 selectNodes，补一层 DOM 点击
    const onDomClick = (ev: Event) => {
      const target = ev.target as HTMLElement | null
      const tpc = target?.closest?.('.me-tpc') as TopicEl | null
      if (!tpc?.nodeObj) return
      emitSelect([tpc.nodeObj])
    }

    mei.bus.addListener('operation', scheduleSave)
    mei.bus.addListener('selectNodes', emitSelect)
    mei.bus.addListener('selectNewNode', (node) => emitSelect([node]))
    mei.container.addEventListener('click', onDomClick)

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      mei.container.removeEventListener('click', onDomClick)
      instanceRef.current = null
      if (hostRef.current) hostRef.current.innerHTML = ''
    }
    // remount via key when switching nodes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const mei = instanceRef.current
    if (!mei || !data) return
    try {
      const current = JSON.stringify(mei.getData())
      const next = JSON.stringify(data)
      if (current !== next) {
        mei.refresh(data as MindElixirData)
      }
    } catch {
      // ignore refresh race
    }
  }, [data])

  return <div className="mindmap-host textbook-mindmap" ref={hostRef} />
}
