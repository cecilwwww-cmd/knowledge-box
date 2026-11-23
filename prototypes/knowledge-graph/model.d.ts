export interface GraphHeading {
  level: 2 | 3
  index: number
  title: string
}

export interface RelationNode {
  id: string
  title: string
  links: Map<string, { tree?: boolean; out?: boolean; in?: boolean }>
}

export interface RelationGraph {
  nodes: Map<string, RelationNode>
}

export interface GraphInput {
  nodes: Array<{ id: string; title: string; parentId?: string | null; sort?: number }>
  mindmaps?: unknown[]
  details?: unknown[]
  sources?: unknown[]
}

export function readGraph(input: GraphInput): RelationGraph
export function sampleBackup(): GraphInput
export function ancestry(graph: RelationGraph, node: RelationNode): RelationNode[]
