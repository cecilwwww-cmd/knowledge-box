import type { DetailDoc, KnowledgeNode, MindmapDoc, SourceItem } from './types'

export type AgentChange<T> = { key: string; before: T | null; after: T | null }

export interface AgentBatch {
  id: 'latest'
  command: string
  nodes: AgentChange<KnowledgeNode>[]
  details: AgentChange<DetailDoc>[]
  maps: AgentChange<MindmapDoc>[]
  sources: AgentChange<SourceItem>[]
}
