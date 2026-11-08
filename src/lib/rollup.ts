import type { AppSettings, MindmapTreeNode, OrganizePreview } from '../db/types'
import { normalizeMathMarkdown } from './normalizeMathMarkdown'
import { treeToMindElixir } from './organize'

export type RollupChildInput = {
  id: string
  title: string
  markdown: string
  mindmapOutline: string
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1].trim() : text.trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return JSON.parse(raw.slice(start, end + 1))
  }
  throw new Error('模型返回中未找到 JSON')
}

/** 从 Mind-elixir 数据抽出简短大纲，供上级汇总（控制长度） */
export function outlineFromMindElixir(data: unknown, maxNodes = 12): string {
  const root = (data as { nodeData?: Record<string, unknown> } | null)?.nodeData
  if (!root) return '（无导图）'
  const lines: string[] = []
  const walk = (node: Record<string, unknown>, depth: number) => {
    if (lines.length >= maxNodes) return
    const topic = String(node.topic || '未命名')
    lines.push(`${'  '.repeat(depth)}- ${topic}`)
    const children = (node.children as Record<string, unknown>[] | undefined) || []
    for (const c of children) {
      if (lines.length >= maxNodes) break
      walk(c, depth + 1)
    }
  }
  walk(root, 0)
  return lines.join('\n')
}

export async function runRollupOrganize(options: {
  settings: AppSettings
  children: RollupChildInput[]
  prompt?: string
}): Promise<{ preview: OrganizePreview; mindElixirData: unknown; title: string }> {
  const { settings, children, prompt } = options
  if (!settings.apiKey.trim()) {
    throw new Error('请先在设置里填写 API Key')
  }
  if (children.length < 2) {
    throw new Error('请至少勾选 2 个节点再生成上级')
  }
  if (children.length > 12) {
    throw new Error('一次最多归类 12 个节点，请分批收拢')
  }

  const childBlock = children
    .map((c, i) => {
      const md = c.markdown.replace(/\s+/g, ' ').trim().slice(0, 1200)
      return `### 子节点 ${i + 1}: ${c.title}
导图大纲：
${c.mindmapOutline.slice(0, 800)}
详情摘要：
${md || '（暂无详情）'}`
    })
    .join('\n\n')

  const system = `你是个人知识库的「自下而上」归类助手。
用户勾选了若干最小知识节点，需要往上生成一个父节点来收拢它们。
必须只输出一个 JSON 对象：
{
  "title": "父节点标题（简洁，像目录名）",
  "mindmap": { "topic": "与 title 一致或更完整的中心主题", "children": [ { "topic": "...", "children": [], "note": "可选" } ] },
  "markdown": "父节点详细内容（Markdown）"
}
硬性要求：
1. markdown 是对子节点的概况归纳：主题脉络、共性、对照要点；禁止复制粘贴子节点全文。
2. mindmap 只提炼各大块主干（大约 3～8 个一级分支即可），不要把子节点细枝末节全摊上来；分支可用子节点名作线索，但内容要概括。
3. 公式用 $...$ 或 $$...$$，不要用方括号包公式。
4. 不要输出 suggestedChildren，不要建议再往下拆子节点。`

  const user = `整理方向：${prompt || '把勾选的零散知识收成上一层目录，并写概况与总览导图。'}

以下是子节点材料：
${childBlock}`

  const base = settings.apiBaseUrl.replace(/\/$/, '')
  const body: Record<string, unknown> = {
    model: settings.modelName,
    temperature: 0.3,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }
  if (/deepseek-flash|deepseek-v4.*flash|flash-vision/i.test(settings.modelName)) {
    body.reasoning_effort = 'none'
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`模型请求失败 (${res.status}): ${errText.slice(0, 300)}`)
  }

  const data = await res.json()
  const message = data.choices?.[0]?.message
  const content = message?.content?.trim() || message?.reasoning_content?.trim()
  if (!content) throw new Error('模型没有返回内容')

  const parsed = extractJson(content) as {
    title?: string
    mindmap?: MindmapTreeNode
    markdown?: string
  }

  const title = (parsed.title || parsed.mindmap?.topic || '归类').trim()
  if (!parsed.mindmap?.topic) {
    parsed.mindmap = { topic: title, children: [] }
  }

  const preview: OrganizePreview = {
    mindmap: parsed.mindmap,
    markdown: normalizeMathMarkdown(parsed.markdown || `# ${title}\n\n`),
  }

  return {
    title,
    preview,
    mindElixirData: treeToMindElixir(preview.mindmap),
  }
}

/** 选中的节点里不能有祖先-后代关系 */
export function assertNoAncestorPairs(
  nodes: Array<{ id: string; parentId: string | null }>,
  selectedIds: string[],
) {
  const set = new Set(selectedIds)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const id of selectedIds) {
    let p = byId.get(id)?.parentId ?? null
    while (p) {
      if (set.has(p)) {
        throw new Error('不能同时勾选某个节点和它的上级，请只勾选要收拢的那一层')
      }
      p = byId.get(p)?.parentId ?? null
    }
  }
}

/** 共同父级：都相同则用该父级；否则用 null（挂到根） */
export function commonParentId(
  nodes: Array<{ id: string; parentId: string | null }>,
  selectedIds: string[],
): string | null {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const parents = selectedIds.map((id) => byId.get(id)?.parentId ?? null)
  const first = parents[0] ?? null
  return parents.every((p) => p === first) ? first : null
}
