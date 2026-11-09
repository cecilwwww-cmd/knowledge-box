import type { MindmapTreeNode } from '../db/types'

export type MindmapLinkMeta = {
  kbNodeId?: string
}

/** 收集导图里已声明的 linkNodeId */
export function collectLinkNodeIds(root: MindmapTreeNode): Set<string> {
  const ids = new Set<string>()
  const walk = (n: MindmapTreeNode) => {
    if (n.linkNodeId) ids.add(n.linkNodeId)
    for (const c of n.children || []) walk(c)
  }
  walk(root)
  return ids
}

/**
 * 确保每个子节点都在导图中有导航入口。
 * 1) 把 AI 误写成标题的 linkNodeId 纠成真实 id
 * 2) 漏掉的子节点追加为一级分支并挂上 linkNodeId
 */
export function ensureChildNavLinks(
  mindmap: MindmapTreeNode,
  children: Array<{ id: string; title: string }>,
): MindmapTreeNode {
  const byId = new Map(children.map((c) => [c.id, c]))
  const byTitle = new Map(
    children.map((c) => [c.title.trim().toLowerCase(), c]),
  )

  const remap = (n: MindmapTreeNode): MindmapTreeNode => {
    let linkNodeId = n.linkNodeId?.trim()
    if (linkNodeId) {
      if (!byId.has(linkNodeId)) {
        const hit = byTitle.get(linkNodeId.toLowerCase())
        linkNodeId = hit?.id
      }
    } else {
      // 节点标题与某子节点完全同名时，自动挂导航
      const hit = byTitle.get((n.topic || '').trim().toLowerCase())
      if (hit) linkNodeId = hit.id
    }
    return {
      ...n,
      linkNodeId: linkNodeId || undefined,
      children: (n.children || []).map(remap),
    }
  }

  const next = remap(mindmap)
  const linked = collectLinkNodeIds(next)
  const missing = children.filter((c) => !linked.has(c.id))
  if (missing.length) {
    next.children = [
      ...(next.children || []),
      ...missing.map((c) => ({
        topic: c.title,
        linkNodeId: c.id,
        children: [] as MindmapTreeNode[],
      })),
    ]
  }
  return next
}
