import { db } from '../db/database'
import { detailImageRef } from '../db/detailImages'
import type { AgentBatch, AgentChange } from '../db/agentTypes'
import type { DetailDoc, KnowledgeNode, MindmapDoc, MindmapTreeNode, SourceItem } from '../db/types'
import { treeToMindElixir } from './organize'
import { normalizeMathMarkdown } from './normalizeMathMarkdown'
import { appendMindmapChildren, MindmapPlanError } from './agentMindmap'

export type AgentScope = 'current' | 'library'

export type AgentSnapshot = {
  nodes: KnowledgeNode[]
  allowed: Set<string>
  rootId: string
  scope: AgentScope
  details: Map<string, DetailDoc>
  maps: Map<string, MindmapDoc>
  sources: Map<string, SourceItem>
}

export type AgentPreview = {
  batch: AgentBatch
  summary: string
  items: { label: string; detail?: string; before?: string; after?: string }[]
  requiredImages: SourceItem[]
  requiredNodes: string[]
  scope: AgentScope
  rootId: string
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('助手返回了无效的操作。')
  return value as Record<string, unknown>
}

function field(value: unknown, limit: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error('助手返回的操作参数不完整或过长。')
  return value
}

function nodesInScope(nodes: KnowledgeNode[], rootId: string, scope: AgentScope) {
  if (!nodes.some(({ id }) => id === rootId)) throw new Error('所选笔记已不存在。')
  if (scope === 'library') return new Set(nodes.map(({ id }) => id))
  const allowed = new Set<string>()
  const children = new Map<string | null, string[]>()
  for (const node of nodes) {
    const entries = children.get(node.parentId) ?? []
    entries.push(node.id)
    children.set(node.parentId, entries)
  }
  const pending = [rootId]
  while (pending.length) {
    const id = pending.pop()!
    if (allowed.has(id)) continue
    allowed.add(id)
    for (const child of children.get(id) ?? []) pending.push(child)
  }
  return allowed
}

export async function readAgentSnapshot(rootId: string, scope: AgentScope): Promise<AgentSnapshot> {
  return db.transaction('r', [db.nodes, db.details, db.mindmaps, db.sources], async () => {
    const nodes = await db.nodes.toArray()
    const allowed = nodesInScope(nodes, rootId, scope)
    const list = [...allowed]
    const [details, maps, sources] = await Promise.all([
      db.details.bulkGet(list), db.mindmaps.bulkGet(list), db.sources.where('nodeId').anyOf(list).toArray(),
    ])
    return {
      nodes, allowed, rootId, scope,
      details: new Map(details.flatMap((item) => item ? [[item.nodeId, item]] : [])),
      maps: new Map(maps.flatMap((item) => item ? [[item.nodeId, item]] : [])),
      sources: new Map(sources.map((item) => [item.id, item])),
    }
  })
}

function assertTree(nodes: KnowledgeNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const checked = new Set<string>()
  for (const { id } of nodes) {
    const path = new Set<string>()
    let current: string | null = id
    while (current !== null && !checked.has(current)) {
      const node = byId.get(current)
      if (!node || path.has(current)) throw new Error('目录关系无效，操作将造成循环或丢失上级。')
      path.add(current)
      current = node.parentId
    }
    for (const item of path) checked.add(item)
  }
}

function parseMapBranches(values: unknown[], resolve: (id: unknown) => string, maxNodes: number, maxDepth: number) {
  let count = 0
  const visit = (raw: unknown, depth: number): MindmapTreeNode => {
    if (++count > maxNodes || depth > maxDepth) {
      throw new MindmapPlanError(`本次导图修改超过上限（${maxNodes} 个节点、${maxDepth + 1} 层）。细化已有导图时请用 extend_mindmap 按分支添加。`)
    }
    const item = object(raw)
    if (item.children !== undefined && !Array.isArray(item.children)) throw new Error('导图分支格式无效。')
    return {
      topic: field(item.topic, 200),
      ...(item.note !== undefined && { note: field(item.note, 1200) }),
      ...(item.linkNodeId !== undefined && { linkNodeId: resolve(item.linkNodeId) }),
      children: (item.children ?? []).map((child: unknown) => visit(child, depth + 1)),
    }
  }
  return values.map((value) => visit(value, 0))
}

function mapOutline(tree: MindmapTreeNode, depth = 0): string {
  return ['  '.repeat(depth) + '- ' + tree.topic, ...(tree.children ?? []).map((item) => mapOutline(item, depth + 1))].join('\n')
}

export function buildAgentPreview(
  snapshot: AgentSnapshot,
  command: string,
  summary: string,
  operations: unknown[],
): AgentPreview {
  if (!operations.length || operations.length > 40) throw new Error('一次任务需要包含 1–40 项修改。')
  const originals = new Map(snapshot.nodes.map((node) => [node.id, node]))
  const current = new Map(originals)
  const aliases = new Map<string, string>()
  const items: AgentPreview['items'] = []
  const requiredImages = new Map<string, SourceItem>()
  const requiredNodes = new Set<string>()
  const batch: AgentBatch = { id: 'latest', command, nodes: [], details: [], maps: [], sources: [] }
  const now = Date.now()
  const nodes = new Map<string, AgentChange<KnowledgeNode>>()
  const details = new Map<string, AgentChange<DetailDoc>>()
  const maps = new Map<string, AgentChange<MindmapDoc>>()
  const addedBranches = new Map<string, number>()
  const siblingSort = new Map<string | null, number>()
  for (const node of snapshot.nodes) {
    siblingSort.set(node.parentId, Math.max(siblingSort.get(node.parentId) ?? 0, node.sort + 1))
  }
  const nextSort = (id: string | null) => {
    const index = siblingSort.get(id) ?? 0
    siblingSort.set(id, index + 1)
    return index
  }
  const resolve = (raw: unknown) => {
    const key = field(raw, 100)
    const id = aliases.get(key) ?? key
    if (!current.has(id) || (!aliases.has(key) && !snapshot.allowed.has(id))) {
      throw new Error('助手引用了不存在或超出范围的笔记。')
    }
    if (!aliases.has(key)) requiredNodes.add(id)
    return id
  }
  const saveNode = (node: KnowledgeNode) => {
    current.set(node.id, node)
    nodes.set(node.id, { key: node.id, before: originals.get(node.id) ?? null, after: node })
  }
  const changeText = (node: KnowledgeNode, markdown: string, label: string) => {
    const before = details.get(node.id)?.after?.markdown ?? snapshot.details.get(node.id)?.markdown ?? ''
    if (before === markdown) return
    details.set(node.id, {
      key: node.id, before: snapshot.details.get(node.id) ?? null,
      after: { nodeId: node.id, markdown, updatedAt: now },
    })
    saveNode({ ...node, updatedAt: now })
    items.push({ label: label + ' · ' + node.title, before, after: markdown })
  }

  for (const raw of operations) {
    const op = object(raw)
    if (op.kind === 'create_folder') {
      const alias = field(op.alias, 70)
      if (!/^new:[\w-]+$/.test(alias) || aliases.has(alias)) throw new Error('新目录标识无效或重复。')
      const parentId = op.parentId === null && snapshot.scope === 'library' ? null : resolve(op.parentId)
      const title = field(op.title, 150).trim()
      const id = crypto.randomUUID()
      aliases.set(alias, id)
      saveNode({ id, parentId, title, sort: nextSort(parentId), updatedAt: now })
      items.push({ label: '新建目录 · ' + title, detail: parentId ? current.get(parentId)?.title : '知识库顶层' })
      continue
    }
    const id = resolve(op.nodeId)
    const node = current.get(id)!
    if (op.kind === 'rename') {
      const title = field(op.title, 150).trim()
      if (title === node.title) continue
      saveNode({ ...node, title, updatedAt: now })
      items.push({ label: '改名', before: node.title, after: title })
    } else if (op.kind === 'move') {
      const parentId = op.parentId === null && snapshot.scope === 'library' ? null : resolve(op.parentId)
      if (parentId === node.parentId) continue
      if (snapshot.scope === 'current' && id === snapshot.rootId) throw new Error('当前范围的根目录不能移动。')
      saveNode({ ...node, parentId, sort: nextSort(parentId), updatedAt: now })
      const parentTitle = (key: string | null) => key ? current.get(key)?.title ?? '上级目录' : '知识库顶层'
      items.push({ label: '移动 · ' + node.title, before: parentTitle(node.parentId), after: parentTitle(parentId) })
    } else if (op.kind === 'mindmap') {
      const [tree] = parseMapBranches([op.tree], resolve, 150, 10)
      maps.set(id, { key: id, before: snapshot.maps.get(id) ?? null, after: {
        nodeId: id, data: treeToMindElixir(tree), updatedAt: now,
      } })
      saveNode({ ...node, updatedAt: now })
      items.push({ label: '更新导图 · ' + node.title, after: mapOutline(tree) })
    } else if (op.kind === 'extend_mindmap') {
      if (!Array.isArray(op.children) || op.children.length === 0) {
        throw new MindmapPlanError('细化导图时需要提供要新增的子分支。')
      }
      const branchId = field(op.branchId, 160)
      const branches = parseMapBranches(op.children, resolve, 30, 3)
      const count = (items: MindmapTreeNode[]): number =>
        items.reduce((sum, item) => sum + 1 + count(item.children ?? []), 0)
      const total = (addedBranches.get(id) ?? 0) + count(branches)
      if (total > 120) throw new MindmapPlanError('同一张导图一次最多新增 120 个节点，请分批细化。')
      addedBranches.set(id, total)
      const before = snapshot.maps.get(id) ?? null
      const base = maps.get(id)?.after?.data ?? before?.data
      const children = branches.map((branch) =>
        (treeToMindElixir(branch) as { nodeData: Record<string, unknown> }).nodeData)
      const extension = appendMindmapChildren(base, branchId, children)
      maps.set(id, { key: id, before, after: { nodeId: id, data: extension.data, updatedAt: now } })
      saveNode({ ...node, updatedAt: now })
      items.push({ label: '细化分支 · ' + extension.topic, after: branches.map((branch) => mapOutline(branch)).join('\n') })
    } else if (op.kind === 'edit') {
      const existing = details.get(id)?.after?.markdown ?? snapshot.details.get(id)?.markdown ?? ''
      let markdown
      if (op.find !== undefined) {
        const find = field(op.find, 10000)
        if (typeof op.replacement !== 'string' || op.replacement.length > 15000 ||
            !existing.includes(find) || existing.indexOf(find) !== existing.lastIndexOf(find)) {
          throw new Error('局部编辑需要唯一匹配的原文，请重新指定。')
        }
        markdown = existing.replace(find, () => op.replacement as string)
      } else {
        if (existing.length > 16000) throw new Error('这篇笔记较长，请让助手只编辑指定段落。')
        markdown = field(op.markdown, 45000)
      }
      const imageRefs = (text: string) => text.match(/!\[[^\]\r\n]*\]\([^\r\n)]*\)|<img\b[^>]*>|#kb-image-[\da-f-]+/gi) ?? []
      const originalRefs = new Set(imageRefs(existing))
      if (imageRefs(markdown).some((ref) => !originalRefs.has(ref))) {
        throw new Error('新插图必须使用原料图片工具。')
      }
      changeText(node, normalizeMathMarkdown(markdown), '编辑正文')
    } else if (op.kind === 'insert_image') {
      const source = snapshot.sources.get(field(op.sourceId, 100))
      if (!source || source.kind !== 'image' || !/^data:image\/(png|jpeg|gif|webp|bmp|avif);base64,/i.test(source.dataUrl ?? '')) {
        throw new Error('找不到指定的原料图片。')
      }
      const row: SourceItem = {
        ...source, id: crypto.randomUUID(), nodeId: id, usage: 'detail-image', createdAt: now,
      }
      requiredImages.set(source.id, source)
      requiredNodes.add(source.nodeId)
      batch.sources.push({ key: row.id, before: null, after: row })
      const text = details.get(id)?.after?.markdown ?? snapshot.details.get(id)?.markdown ?? ''
      const alt = field(op.alt, 150).replace(/[\[\]\r\n\\]/g, ' ')
      const snippet = '\n\n![' + alt + '](' + detailImageRef(row.id) + ')\n\n'
      const anchor = op.after === undefined ? '' : field(op.after, 400)
      if (anchor && (text.indexOf(anchor) < 0 || text.indexOf(anchor) !== text.lastIndexOf(anchor))) {
        throw new Error('找不到唯一的插图位置，请指定明确的小节或句子。')
      }
      const lineEnd = anchor ? text.indexOf('\n', text.indexOf(anchor) + anchor.length) : -1
      const index = lineEnd < 0 ? text.length : lineEnd
      changeText(node, text.slice(0, index) + snippet + text.slice(index), '插入图片「' + source.name + '」')
    } else {
      throw new Error('助手返回了不支持的操作。')
    }
  }
  assertTree([...current.values()])
  if (!items.length) throw new Error('方案里没有需要应用的改动。')
  batch.nodes = [...nodes.values()]
  batch.details = [...details.values()]
  batch.maps = [...maps.values()]
  return {
    batch, summary, items, requiredImages: [...requiredImages.values()],
    requiredNodes: [...requiredNodes], scope: snapshot.scope, rootId: snapshot.rootId,
  }
}

const same = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

export async function writeAgentChanges(preview: AgentPreview | undefined) {
  const undo = !preview
  return db.transaction('rw', [db.agentBatches, db.nodes, db.details, db.mindmaps, db.sources], async () => {
    const batch = preview?.batch ?? await db.agentBatches.get('latest')
    if (!batch) throw new Error('没有可以撤销的助手操作。')
    const validate = async <T>(changes: AgentChange<T>[], table: { get: (key: string) => PromiseLike<T | undefined> }) => {
      for (const row of changes) {
        if (!same(await table.get(row.key), undo ? row.after : row.before)) {
          throw new Error('相关笔记或资料已被修改，请重新生成方案，或保留这次手动改动。')
        }
      }
    }
    await validate(batch.nodes, db.nodes)
    await validate(batch.details, db.details)
    await validate(batch.maps, db.mindmaps)
    await validate(batch.sources, db.sources)
    for (const source of preview?.requiredImages ?? []) {
      if (!same(await db.sources.get(source.id), source)) throw new Error('原料图片已发生变化，请重新生成方案。')
    }
    const allNodes = new Map((await db.nodes.toArray()).map((node) => [node.id, node]))
    if (preview) {
      const allowed = nodesInScope([...allNodes.values()], preview.rootId, preview.scope)
      if (preview.requiredNodes.some((id) => !allowed.has(id))) {
        throw new Error('部分目标已移出所选范围，请重新生成方案。')
      }
    }
    for (const row of batch.nodes) {
      const next = undo ? row.before : row.after
      if (next) allNodes.set(row.key, next)
      else {
        if (await db.sources.where('nodeId').equals(row.key).filter((source) =>
          !batch.sources.some(({ key }) => key === source.id)).count() ||
          (await db.details.get(row.key) && !batch.details.some(({ key }) => key === row.key)) ||
          (await db.mindmaps.get(row.key) && !batch.maps.some(({ key }) => key === row.key))) {
          throw new Error('新建目录中已有其他资料，无法整批撤销。')
        }
        allNodes.delete(row.key)
      }
    }
    assertTree([...allNodes.values()])
    const write = async <T>(changes: AgentChange<T>[], table: {
      delete: (key: string) => PromiseLike<unknown>; put: (item: T) => PromiseLike<unknown>
    }) => {
      for (const row of changes) {
        const next = undo ? row.before : row.after
        if (next) await table.put(next)
        else await table.delete(row.key)
      }
    }
    await write(batch.nodes, db.nodes)
    await write(batch.details, db.details)
    await write(batch.maps, db.mindmaps)
    await write(batch.sources, db.sources)
    if (undo) await db.agentBatches.delete('latest')
    else await db.agentBatches.put(batch)
  })
}
