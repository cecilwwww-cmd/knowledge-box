import type { AppSettings, MindmapTreeNode, OrganizePreview, SourceItem } from '../db/types'

type ChatContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >

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

function buildUserContent(
  nodeTitle: string,
  prompt: string,
  sources: SourceItem[],
  existingMarkdown?: string,
): ChatContent {
  const sourceBlock = sources
    .map((s, i) => {
      const head = `### 来源 ${i + 1}: ${s.name}${s.kind ? `（${s.kind}）` : ''}`
      return `${head}\n${s.textContent.slice(0, 12000)}`
    })
    .join('\n\n')

  const text = `当前节点标题：${nodeTitle}

整理方向（汇总提示词）：
${prompt || '自动归纳要点，生成清晰导图与详细说明。请认真阅读原料（含 OCR / PDF / Word / HTML 提取结果与图片）。'}

${existingMarkdown ? `现有详细内容（可合并改写，勿无故删掉重要手改）：\n${existingMarkdown.slice(0, 4000)}\n` : ''}

原料：
${sourceBlock || '（无附加原料，仅按提示词与节点标题整理）'}`

  return text
}

function modelSupportsVision(modelName: string) {
  return /gpt-4o|gpt-4\.1|claude|gemini|vision|qwen-vl|glm-4v|moonshot-v1/i.test(
    modelName,
  )
}

function withOptionalImages(
  text: string,
  sources: SourceItem[],
  modelName: string,
): ChatContent {
  if (!modelSupportsVision(modelName)) return text
  const images = sources.filter((s) => s.kind === 'image' && s.dataUrl).slice(0, 4)
  if (!images.length) return text
  return [
    { type: 'text', text },
    ...images.map((img) => ({
      type: 'image_url' as const,
      image_url: { url: img.dataUrl! },
    })),
  ]
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

  const system = `你是个人知识整理助手。根据用户提供的原料与整理方向，产出结构化结果。
原料可能来自文本、HTML、PDF、Word 或图片 OCR；若同时附带图片，请结合图像内容理解题目/图表。
必须只输出一个 JSON 对象，不要解释，格式如下：
{
  "mindmap": { "topic": "中心主题", "children": [ { "topic": "...", "children": [], "note": "可选短注" } ] },
  "markdown": "详细内容，使用 Markdown",
  "suggestedChildren": ["可选的子节点标题"]
}
要求：思维导图层次清晰；详细内容可独立阅读；引用原料时可用「来源N」标记；不要声称无法解析图片，应基于已提供的 OCR 文本与图片作答。`

  const userContent = withOptionalImages(
    buildUserContent(nodeTitle, prompt, sources, options.existingMarkdown) as string,
    sources,
    settings.modelName,
  )

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
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    // 部分纯文本模型不接受 image_url，自动降级为纯文本再试一次
    if (
      Array.isArray(userContent) &&
      /image|vision|multimodal|不支持/i.test(errText)
    ) {
      const retry = await fetch(`${base}/chat/completions`, {
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
            {
              role: 'user',
              content: typeof userContent === 'string'
                ? userContent
                : userContent
                    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                    .map((p) => p.text)
                    .join('\n'),
            },
          ],
        }),
      })
      if (!retry.ok) {
        const retryText = await retry.text()
        throw new Error(`模型请求失败 (${retry.status}): ${retryText.slice(0, 300)}`)
      }
      return parseOrganizeResponse(await retry.json())
    }
    throw new Error(`模型请求失败 (${res.status}): ${errText.slice(0, 300)}`)
  }

  return parseOrganizeResponse(await res.json())
}

function parseOrganizeResponse(data: {
  choices?: Array<{ message?: { content?: string } }>
}): { preview: OrganizePreview; mindElixirData: unknown } {
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
