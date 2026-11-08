export type NodeId = string

export interface KnowledgeNode {
  id: NodeId
  parentId: NodeId | null
  title: string
  sort: number
  updatedAt: number
}

export interface SourceItem {
  id: string
  nodeId: NodeId
  name: string
  mimeType: string
  textContent: string
  /** 图片等可附带 data URL，便于多模态模型识图 */
  dataUrl?: string
  kind?: 'text' | 'html' | 'pdf' | 'word' | 'image' | 'unknown'
  size: number
  createdAt: number
}

export interface MindmapDoc {
  nodeId: NodeId
  data: unknown
  updatedAt: number
}

export interface DetailDoc {
  nodeId: NodeId
  markdown: string
  updatedAt: number
}

export interface Snapshot {
  id: string
  nodeId: NodeId
  mindmap: unknown
  markdown: string
  prompt: string
  createdAt: number
}

export interface AppSettings {
  id: 'main'
  apiBaseUrl: string
  apiKey: string
  modelName: string
}

export interface OrganizePreview {
  mindmap: MindmapTreeNode
  markdown: string
  suggestedChildren?: string[]
}

export interface MindmapTreeNode {
  topic: string
  children?: MindmapTreeNode[]
  note?: string
}
