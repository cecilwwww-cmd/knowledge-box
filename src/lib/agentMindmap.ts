type MapNode = Record<string, unknown> & {
  id?: string
  topic?: string
  children?: MapNode[]
}

function nodeData(data: unknown): MapNode | undefined {
  const root = (data as { nodeData?: MapNode } | null)?.nodeData
  return root && typeof root === 'object' ? root : undefined
}

export class MindmapPlanError extends Error {}

export function readAgentMindmap(data: unknown, query = '', limit = 80) {
  const root = nodeData(data)
  if (!root) return []
  const result: { branchId: string; topic: string; note?: string; parentBranchId?: string; leaf: boolean }[] = []
  const pending = [{ node: root, parentBranchId: undefined as string | undefined }]
  while (pending.length && result.length < limit) {
    const { node, parentBranchId } = pending.pop()!
    const children = Array.isArray(node.children) ? node.children : []
    const topic = typeof node.topic === 'string' ? node.topic : '未命名'
    const id = typeof node.id === 'string' ? node.id : undefined
    if (id && (!query || topic.toLocaleLowerCase().includes(query))) {
      result.push({
        branchId: id, topic: topic.slice(0, 180), parentBranchId, leaf: children.length === 0,
        ...(typeof node.note === 'string' && { note: node.note.slice(0, 500) }),
      })
    }
    for (let i = children.length - 1; i >= 0; i--) {
      if (children[i] && typeof children[i] === 'object') pending.push({ node: children[i], parentBranchId: id })
    }
  }
  return result
}

export function appendMindmapChildren(data: unknown, branchId: string, additions: Record<string, unknown>[]) {
  const copy = structuredClone(data)
  const root = nodeData(copy)
  if (!root) throw new MindmapPlanError('这篇笔记还没有可扩写的导图，请生成一张新的导图。')
  const pending = [root]
  let branch: MapNode | undefined
  while (pending.length) {
    const node = pending.pop()!
    if (node.id === branchId) {
      if (branch) throw new MindmapPlanError('目标分支标识重复，请先选择其他分支。')
      branch = node
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) if (child && typeof child === 'object') pending.push(child)
    }
  }
  if (!branch) throw new MindmapPlanError('找不到要细化的分支。请读取真实分支 ID，再选择扩写位置。')

  const assignIds = (node: MapNode): MapNode => {
    const added: MapNode = { ...node, id: crypto.randomUUID(), children: node.children?.map(assignIds) }
    delete added.root
    return added
  }
  const children = Array.isArray(branch.children) ? branch.children : []
  branch.children = [...children, ...additions.map(assignIds)]
  if (branch.expanded === false) branch.expanded = true
  return { data: copy, topic: branch.topic ?? '选中分支' }
}
