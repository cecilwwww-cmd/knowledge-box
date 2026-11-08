import MindElixir from 'mind-elixir'
import type { MindElixirData } from 'mind-elixir'
import 'mind-elixir/style.css'
import { useEffect, useRef } from 'react'
import { TEXTBOOK_MINDMAP_THEME } from '../lib/mindmapTheme'

interface Props {
  data: unknown
  onChange: (data: unknown) => void
}

export function MindmapEditor({ data, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<InstanceType<typeof MindElixir> | null>(null)
  const saveTimer = useRef<number | null>(null)

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
        onChange(mei.getData())
      }, 400)
    }

    mei.bus.addListener('operation', scheduleSave)

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
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
