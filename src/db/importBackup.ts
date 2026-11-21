import { db } from './database'
import type { DetailDoc, KnowledgeNode, MindmapDoc, Snapshot, SourceItem } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readRows<T>(
  list: unknown,
  strings: string[],
  numbers: string[],
  extra: (row: Record<string, unknown>) => boolean = () => true,
): T[] {
  if (!Array.isArray(list) || !list.every((row: unknown) =>
    isRecord(row) &&
    strings.every((key) => typeof row[key] === 'string') &&
    numbers.every((key) => Number.isFinite(row[key])) &&
    extra(row),
  )) {
    throw new Error('备份格式不正确，请选择从知识箱导出的 JSON 文件。')
  }
  return list as T[]
}

function newRows<T>(rows: T[], existingKeys: string[], key: (row: T) => string) {
  const seen = new Set(existingKeys)
  return rows.filter((row) => {
    const id = key(row)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export async function importBackup(file: File) {
  const backup: unknown = JSON.parse(await file.text())
  if (!isRecord(backup)) throw new Error('请选择从知识箱导出的 JSON 备份。')

  const nodes = readRows<KnowledgeNode>(backup.nodes, ['id', 'title'], ['sort', 'updatedAt'],
    (row) => row.parentId === null || typeof row.parentId === 'string')
  const sources = readRows<SourceItem>(backup.sources, ['id', 'nodeId', 'name', 'mimeType', 'textContent'], ['size', 'createdAt'],
    (row) => row.dataUrl === undefined || typeof row.dataUrl === 'string')
  const maps = readRows<MindmapDoc>(backup.mindmaps, ['nodeId'], ['updatedAt'], (row) => 'data' in row)
  const details = readRows<DetailDoc>(backup.details, ['nodeId', 'markdown'], ['updatedAt'])
  const snapshots = readRows<Snapshot>(backup.snapshots, ['id', 'nodeId', 'markdown', 'prompt'], ['createdAt'],
    (row) => 'mindmap' in row)

  return db.transaction('rw', [db.nodes, db.sources, db.mindmaps, db.details, db.snapshots], async () => {
    const existing = await db.nodes.toArray()
    const added = newRows(nodes, existing.map(({ id }) => id), (row) => row.id)
    const parents = new Map([...existing, ...added].map(({ id, parentId }) => [id, parentId]))
    const validated = new Set<string>()
    for (const { id } of added) {
      const lineage = new Set<string>()
      let current: string | null | undefined = id
      while (typeof current === 'string' && !validated.has(current)) {
        if (lineage.has(current) || !parents.has(current)) {
          throw new Error('备份中的目录关系不完整或存在循环。')
        }
        lineage.add(current)
        current = parents.get(current)
      }
      for (const ancestor of lineage) validated.add(ancestor)
    }

    const documents = [...sources, ...maps, ...details, ...snapshots]
    if (documents.some(({ nodeId }) => !parents.has(nodeId))) {
      throw new Error('备份中有资料找不到对应的笔记。')
    }

    await db.nodes.bulkAdd(added)
    await db.sources.bulkAdd(newRows(sources, await db.sources.toCollection().primaryKeys(), (row) => row.id))
    await db.mindmaps.bulkAdd(newRows(maps, await db.mindmaps.toCollection().primaryKeys(), (row) => row.nodeId))
    await db.details.bulkAdd(newRows(details, await db.details.toCollection().primaryKeys(), (row) => row.nodeId))
    await db.snapshots.bulkAdd(newRows(snapshots, await db.snapshots.toCollection().primaryKeys(), (row) => row.id))
    return added.length
  })
}
