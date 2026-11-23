import type { GraphHeading, RelationGraph, RelationNode } from './model.js'

interface CanvasView {
  setGraph(graph: RelationGraph, keepView?: boolean): void
  setScope(ids: Set<string> | null, fitView?: boolean): void
  select(node: RelationNode): void
  center(node: RelationNode): void
  fit(smooth?: boolean): void
  zoom(scale: number): void
  highlight(ids: Set<string> | null): void
  edgeType(type: 'tree' | 'nav', enabled: boolean): void
  destroy(): void
}

export function createCanvas(
  canvas: HTMLCanvasElement,
  tooltip: HTMLElement,
  onSelect: (node: RelationNode, heading?: GraphHeading) => void,
  onFocus: (node: RelationNode) => void,
  options?: { preserveResize?: boolean },
): CanvasView
