import type { AppSettings, MindmapTreeNode, OrganizePreview } from '../db/types'
import {
  detailTemplatePromptGuide,
  resolveDetailTemplate,
} from './detailTemplates'
import { ensureLeadingH1 } from './ensureLeadingH1'
import { ensureChildNavLinks } from './mindmapLink'
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
  /** 用户自命名时传入；不传则由 AI 总结标题 */
  fixedTitle?: string
}): Promise<{ preview: OrganizePreview; mindElixirData: unknown; title: string }> {
  const { settings, children, prompt, fixedTitle } = options
  if (!settings.apiKey.trim()) {
    throw new Error('请先在设置里填写 API Key')
  }
  if (children.length < 2) {
    throw new Error('请至少勾选 2 个节点再生成上级')
  }
  const manualTitle = fixedTitle?.trim()
  if (fixedTitle !== undefined && !manualTitle) {
    throw new Error('请填写上级节点标题')
  }

  // 节点多时自动缩短单节点摘要，避免撑爆上下文；不限制勾选数量
  const mdBudget = Math.max(280, Math.min(1200, Math.floor(18000 / children.length)))
  const outlineBudget = Math.max(160, Math.min(800, Math.floor(10000 / children.length)))

  const childBlock = children
    .map((c, i) => {
      const md = c.markdown.replace(/\s+/g, ' ').trim().slice(0, mdBudget)
      return `### 子节点 ${i + 1}
id: ${c.id}
title: ${c.title}
导图大纲：
${c.mindmapOutline.slice(0, outlineBudget)}
详情摘要：
${md || '（暂无详情）'}`
    })
    .join('\n\n')

  const detailTpl = resolveDetailTemplate(settings.detailTemplate)

  const system = `你是个人知识库的「自下而上」归类助手。
用户勾选了若干最小知识节点，需要往上生成一个父节点来收拢它们。
必须只输出一个 JSON 对象：
{
  "title": "父节点标题（简洁，像目录名）",
  "mindmap": {
    "topic": "中心主题",
    "children": [
      { "topic": "大块标题", "children": [
        { "topic": "导航点", "linkNodeId": "子节点id", "children": [] }
      ]}
    ]
  },
  "markdown": "父节点详细内容（Markdown）"
}
硬性要求：
1. markdown 是对子节点的概况归纳：主题脉络、共性、对照要点；禁止复制粘贴子节点全文。
${detailTemplatePromptGuide(detailTpl)}
2. mindmap 按教材逻辑图：一级若干大块短标题；不是每个分支都要导航，但每一个子节点都必须至少出现一次 linkNodeId（值必须是材料里给出的 id）。
3. linkNodeId 只能填子节点 id，不要填标题；无导航的概括分支可以不写 linkNodeId。
4. 公式用 $...$ 或 $$...$$，不要用方括号包公式。
5. 不要输出 suggestedChildren，不要建议再往下拆子节点。
${manualTitle ? `6. 用户已指定父节点标题为「${manualTitle}」：JSON 的 title 与 mindmap.topic 必须使用该标题。` : '6. 请根据子节点内容总结一个简洁准确的父节点标题。'}`

  const user = `整理方向：${prompt || '把勾选的零散知识收成上一层目录，写概况与总览导图，并为每个子节点生成导图导航联动。'}
${manualTitle ? `用户指定标题：${manualTitle}\n` : '标题模式：由你总结命名。\n'}
以下是子节点材料（linkNodeId 必须使用其中的 id）：
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

  const title = (manualTitle || parsed.title || parsed.mindmap?.topic || '归类').trim()
  if (!parsed.mindmap) {
    parsed.mindmap = { topic: title, children: [] }
  } else {
    parsed.mindmap.topic = title
  }

  const linkedMindmap = ensureChildNavLinks(
    parsed.mindmap,
    children.map((c) => ({ id: c.id, title: c.title })),
  )

  const preview: OrganizePreview = {
    title,
    mindmap: linkedMindmap,
    markdown: ensureLeadingH1(
      normalizeMathMarkdown(parsed.markdown || ''),
      title,
    ),
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
