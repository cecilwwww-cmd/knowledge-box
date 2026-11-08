import type { AppSettings, MindmapTreeNode, OrganizePreview, SourceItem } from '../db/types'

function treeToMindElixir(tree: MindmapTreeNode) {
  let counter = 0
  const walk = (node: MindmapTreeNode, isRoot = false): Record<string, unknown> => {
    counter += 1
    return {
      id: isRoot ? 'root' : `n-${counter}`,
      topic: node.topic || '未命名',
      root: isRoot || undefined,
      note: node.note,
      children: (node.children || []).map((c) => walk(c)),
    }
  }
  return { nodeData: walk(tree, true) }
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

export async function runOrganize(options: {
  settings: AppSettings
  nodeTitle: string
  prompt: string
  sources: SourceItem[]
  existingMarkdown?: string
  existingMindmapSummary?: string
}): Promise<{ preview: OrganizePreview; mindElixirData: unknown }> {
  const { settings, nodeTitle, prompt, sources } = options

  if (!settings.apiKey.trim()) {
    throw new Error('请先在设置里填写 API Key')
  }

  const sourceBlock = sources
    .map((s, i) => `### 来源 ${i + 1}: ${s.name}\n${s.textContent.slice(0, 8000)}`)
    .join('\n\n')

  const system = `你是个人知识整理助手。根据用户提供的原料与整理方向，产出结构化结果。
必须只输出一个 JSON 对象，不要解释，格式如下：
{
  "mindmap": { "topic": "中心主题", "children": [ { "topic": "...", "children": [], "note": "可选短注" } ] },
  "markdown": "详细内容，使用 Markdown",
  "suggestedChildren": ["可选的子节点标题"]
}
要求：思维导图层次清晰；详细内容可独立阅读；引用原料时可用「来源N」标记。`

  const user = `当前节点标题：${nodeTitle}

整理方向（汇总提示词）：
${prompt || '自动归纳要点，生成清晰导图与详细说明。'}

${options.existingMarkdown ? `现有详细内容（可合并改写，勿无故删掉重要手改）：\n${options.existingMarkdown.slice(0, 4000)}\n` : ''}

原料：
${sourceBlock || '（无附加原料，仅按提示词与节点标题整理）'}`

  const base = settings.apiBaseUrl.replace(/\/$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.modelName,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`模型请求失败 (${res.status}): ${errText.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('模型没有返回内容')

  const parsed = extractJson(content) as {
    mindmap?: MindmapTreeNode
    markdown?: string
    suggestedChildren?: string[]
  }

  if (!parsed.mindmap?.topic) {
    throw new Error('返回 JSON 缺少 mindmap.topic')
  }

  const preview: OrganizePreview = {
    mindmap: parsed.mindmap,
    markdown: parsed.markdown || `# ${parsed.mindmap.topic}\n`,
    suggestedChildren: parsed.suggestedChildren,
  }

  return {
    preview,
    mindElixirData: treeToMindElixir(preview.mindmap),
  }
}

export { treeToMindElixir }
