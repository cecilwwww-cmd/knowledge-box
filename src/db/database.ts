import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSettings,
  DetailDoc,
  KnowledgeNode,
  MindmapDoc,
  Snapshot,
  SourceItem,
} from './types'

const defaultMindmap = (title: string) => ({
  nodeData: {
    id: 'root',
    topic: title,
    root: true,
    children: [],
  },
})

export class KnowledgeBoxDB extends Dexie {
  nodes!: EntityTable<KnowledgeNode, 'id'>
  sources!: EntityTable<SourceItem, 'id'>
  mindmaps!: EntityTable<MindmapDoc, 'nodeId'>
  details!: EntityTable<DetailDoc, 'nodeId'>
  snapshots!: EntityTable<Snapshot, 'id'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor() {
    super('knowledge-box')
    this.version(1).stores({
      nodes: 'id, parentId, sort, updatedAt',
      sources: 'id, nodeId, createdAt',
      mindmaps: 'nodeId, updatedAt',
      details: 'nodeId, updatedAt',
      snapshots: 'id, nodeId, createdAt',
      settings: 'id',
    })
  }
}

export const db = new KnowledgeBoxDB()

export async function ensureSeedData() {
  const count = await db.nodes.count()
  if (count > 0) return

  const now = Date.now()
  const rootId = crypto.randomUUID()
  const childId = crypto.randomUUID()

  await db.transaction(
    'rw',
    db.nodes,
    db.mindmaps,
    db.details,
    db.settings,
    async () => {
      await db.nodes.bulkAdd([
        {
          id: rootId,
          parentId: null,
          title: '我的知识库',
          sort: 0,
          updatedAt: now,
        },
        {
          id: childId,
          parentId: rootId,
          title: '示例：科研积累',
          sort: 0,
          updatedAt: now,
        },
      ])

      await db.mindmaps.bulkAdd([
        { nodeId: rootId, data: defaultMindmap('我的知识库'), updatedAt: now },
        {
          nodeId: childId,
          data: defaultMindmap('示例：科研积累'),
          updatedAt: now,
        },
      ])

      await db.details.bulkAdd([
        {
          nodeId: rootId,
          markdown:
            '# 我的知识库\n\n把材料拖进上方整理条，填写提示词后点「开始整理」。',
          updatedAt: now,
        },
        {
          nodeId: childId,
          markdown:
            '# 示例：科研积累\n\n这是一个示例节点。你可以在左侧新建文件夹/笔记，或直接拖入文档让 AI 生成思维导图与详细内容。',
          updatedAt: now,
        },
      ])

      await db.settings.put({
        id: 'main',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        modelName: 'gpt-4o-mini',
      })
    },
  )
}

export { defaultMindmap }
