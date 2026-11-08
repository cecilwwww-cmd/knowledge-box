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
  /** 像对话框一样把原图发给模型（需多模态 / 识图模型） */
  sendImages?: boolean
}

export interface OrganizePreview {
  mindmap: MindmapTreeNode
  markdown: string
  /** 目录树节点标题（叶子整理或上级归类） */
  title?: string
}

export interface MindmapTreeNode {
  topic: string
  children?: MindmapTreeNode[]
  note?: string
}
