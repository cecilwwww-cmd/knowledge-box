import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../db/database'
import '../../prototypes/knowledge-graph/vendor/d3-layout.js'
import { createCanvas } from '../../prototypes/knowledge-graph/canvas.js'
import { readGraph, type GraphHeading, type RelationGraph } from '../../prototypes/knowledge-graph/model.js'

interface Props {
  nodeId: string
  onSelectNode: (id: string, heading?: GraphHeading) => void
}

export function MindmapRelationshipGraph({ nodeId, onSelectNode }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const tooltip = useRef<HTMLDivElement>(null)
  const drawing = useRef<ReturnType<typeof createCanvas> | null>(null)
  const loaded = useRef<RelationGraph | null>(null)
  const lastScope = useRef<string | null>(null)
  const selectRef = useRef(onSelectNode)
  selectRef.current = onSelectNode
  const [focused, setFocused] = useState(false)
  const [selectedId, setSelectedId] = useState(nodeId)

  const graph = useLiveQuery(async () => {
    const [nodes, mindmaps, details] = await db.transaction(
      'r', [db.nodes, db.mindmaps, db.details],
      () => Promise.all([db.nodes.toArray(), db.mindmaps.toArray(), db.details.toArray()]),
    )
    return nodes.length ? readGraph({ nodes, mindmaps, details }) : null
  }, [])

  useEffect(() => {
    if (!canvas.current || !tooltip.current) return
    const view = createCanvas(canvas.current, tooltip.current, (node, heading) => {
      setSelectedId(node.id)
      selectRef.current(node.id, heading)
    }, (node) => {
      setSelectedId(node.id)
      setFocused(true)
    }, { preserveResize: true })
    drawing.current = view
    return () => {
      view.destroy()
      drawing.current = null
      loaded.current = null
      lastScope.current = null
    }
  }, [])

  useEffect(() => {
    const view = drawing.current
    if (!view || !graph) return
    const target = graph.nodes.get(selectedId) ?? graph.nodes.get(nodeId)
    if (!target) return
    const changed = loaded.current !== graph
    if (changed) {
      view.setGraph(graph, !!loaded.current)
      loaded.current = graph
    }
    view.select(target)
    const scope = focused ? target.id : ''
    const scopeChanged = scope !== lastScope.current
    if (changed || scopeChanged) {
      view.setScope(focused ? new Set([target.id, ...target.links.keys()]) : null, scopeChanged)
      lastScope.current = scope
    }
  }, [graph, focused, nodeId, selectedId])

  return (
    <div className="mind-relation-graph">
      <canvas ref={canvas} aria-label="关系图谱，单击节点打开对应详情" />
      <div ref={tooltip} className="mind-relation-tooltip" hidden />
      <div className="mind-relation-tools">
        <button type="button" aria-pressed={!focused} onClick={() => setFocused(false)}>全库</button>
        <button type="button" aria-pressed={focused} onClick={() => setFocused(true)}>聚焦当前</button>
        {graph && (
          <select
            aria-label="选择节点查看详细内容"
            value={graph.nodes.has(selectedId) ? selectedId : nodeId}
            onChange={(event) => {
              const id = event.target.value
              setSelectedId(id)
              onSelectNode(id)
            }}
          >
            {[...graph.nodes.values()].map((node) => (
              <option key={node.id} value={node.id}>{node.title}</option>
            ))}
          </select>
        )}
      </div>
      <div className="mind-relation-zoom" aria-label="图谱视角">
        <button type="button" aria-label="放大" onClick={() => drawing.current?.zoom(1.24)}>+</button>
        <button type="button" aria-label="缩小" onClick={() => drawing.current?.zoom(1 / 1.24)}>−</button>
        <button type="button" aria-label="适应画布" onClick={() => drawing.current?.fit()}>⌖</button>
      </div>
    </div>
  )
}
