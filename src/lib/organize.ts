import type { AppSettings, MindmapTreeNode, OrganizePreview, SourceItem } from '../db/types'
import { normalizeMathMarkdown } from './normalizeMathMarkdown'

type ChatContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' | 'original' } }
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

/** 压缩 data URL，避免请求体过大（DeepSeek 请求体上限 48MiB） */
async function compressDataUrl(dataUrl: string, maxSide = 1600): Promise<string> {
  if (!dataUrl.startsWith('data:image')) return dataUrl
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('图片预览加载失败'))
    el.src = dataUrl
  })
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.88)
}

/** 明确不支持 image_url 的纯文本模型 */
function looksLikeTextOnlyModel(modelName: string) {
  return /^(deepseek-chat|deepseek-reasoner|deepseek-coder|gpt-3\.5|o1-mini)(-|$)/i.test(
    modelName.trim(),
  )
}

function isDeepSeekFlash(modelName: string) {
  return /deepseek-flash|deepseek-v4.*flash|flash-vision/i.test(modelName)
}

function buildTextPrompt(
  nodeTitle: string,
  prompt: string,
  sources: SourceItem[],
  existingMarkdown: string | undefined,
  sendingImages: boolean,
  fixedTitle?: string,
): string {
  const sourceBlock = sources
    .map((s, i) => {
      const head = `### 来源 ${i + 1}: ${s.name}${s.kind ? `（${s.kind}）` : ''}`
      if (s.kind === 'image' && sendingImages) {
        const ocrHint = s.textContent
          ? `\n本地 OCR 仅供参考（常有错字，示意图无法靠 OCR 理解）：\n${s.textContent.slice(0, 1800)}`
          : ''
        return `${head}\n已附带原图，请直接看图理解题干、坐标/受力示意图与侧边要点。${ocrHint}`
      }
      return `${head}\n${s.textContent.slice(0, 12000)}`
    })
    .join('\n\n')

  return `当前节点标题：${nodeTitle}
${fixedTitle ? `用户指定的目录标题：${fixedTitle}（JSON 的 title 与 mindmap.topic 必须用此标题）\n` : '标题模式：请根据原料总结一个简洁的目录标题（写入 JSON.title）。\n'}
整理方向（汇总提示词）：
${prompt || '自动归纳要点，生成清晰导图与详细说明。'}

${existingMarkdown ? `现有详细内容（可合并改写，勿无故删掉重要手改）：\n${existingMarkdown.slice(0, 4000)}\n` : ''}
${sendingImages ? '重要：下面消息里附有原图。请像聊天识图一样阅读图片中的文字、公式与抽象示意图；不要只依赖 OCR 文本。\n' : ''}
原料：
${sourceBlock || '（无附加原料，仅按提示词与节点标题整理）'}`
}

async function buildUserContent(
  nodeTitle: string,
  prompt: string,
  sources: SourceItem[],
  existingMarkdown: string | undefined,
  sendImages: boolean,
  fixedTitle?: string,
): Promise<ChatContent> {
  const imageSources = sources.filter((s) => s.kind === 'image' && s.dataUrl).slice(0, 4)
  const sendingImages = sendImages && imageSources.length > 0
  const text = buildTextPrompt(
    nodeTitle,
    prompt,
    sources,
    existingMarkdown,
    sendingImages,
    fixedTitle,
  )

  if (!sendingImages) return text

  const parts: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' | 'original' } }
  > = [{ type: 'text', text }]

  for (const img of imageSources) {
    const url = await compressDataUrl(img.dataUrl!)
    parts.push({
      type: 'image_url',
      image_url: { url, detail: 'high' },
    })
  }
  return parts
}

export async function runOrganize(options: {
  settings: AppSettings
  nodeTitle: string
  prompt: string
  sources: SourceItem[]
  existingMarkdown?: string
  existingMindmapSummary?: string
  /** 用户自命名；不传则由模型总结 title */
  fixedTitle?: string
}): Promise<{ preview: OrganizePreview; mindElixirData: unknown }> {
  const { settings, nodeTitle, prompt, sources, fixedTitle } = options

  if (!settings.apiKey.trim()) {
    throw new Error('请先在设置里填写 API Key（或由管理员在部署环境变量里配置）')
  }

  const manualTitle = fixedTitle?.trim()
  if (fixedTitle !== undefined && !manualTitle) {
    throw new Error('请填写节点标题')
  }

  const sendImages = settings.sendImages !== false
  const hasImages = sources.some((s) => s.kind === 'image' && s.dataUrl)

  if (sendImages && hasImages && looksLikeTextOnlyModel(settings.modelName)) {
    throw new Error(
      `「${settings.modelName}」是纯文本模型，看不懂示意图。请改用 deepseek-flash（官方识图模型）。`,
    )
  }

  const system = `你是个人知识整理助手。根据用户提供的原料与整理方向，产出结构化结果。
若消息中附带图片，必须像网页聊天识图一样直接理解图中的文字、公式、坐标系与抽象示意图（如受力、磁场、导轨等），不要声称无法看图；本地 OCR 文本常有错误，以图片为准。
必须只输出一个 JSON 对象，不要解释，格式如下：
{
  "title": "简洁目录标题（像笔记名，勿过长）",
  "mindmap": { "topic": "中心主题", "children": [ { "topic": "...", "children": [], "note": "可选短注" } ] },
  "markdown": "详细内容，使用 Markdown"
}
要求：思维导图层次清晰；详细内容可独立阅读；引用原料时可用「来源N」标记。
重要：当前节点是最小知识单元。题干拆解、小问、受力分析等只能写进「详细内容」和「思维导图」，
严禁输出 suggestedChildren，严禁要求在目录树下再建子节点（目录往上归类，不往下拆）。
${manualTitle ? `用户已指定目录标题「${manualTitle}」：title 与 mindmap.topic 必须使用该标题。` : '请根据原料总结 title（目录名），mindmap.topic 可与 title 一致或略完整。'}
公式必须用 KaTeX 兼容写法：行内 $E=IR$，独立公式用 $$...$$（不要用 [ ] 或 \\[ \\] 包公式）。`

  const userContent = await buildUserContent(
    nodeTitle,
    prompt,
    sources,
    options.existingMarkdown,
    sendImages,
    manualTitle,
  )

  const base = settings.apiBaseUrl.replace(/\/$/, '')
  const body: Record<string, unknown> = {
    model: settings.modelName,
    temperature: 0.3,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
  }

  // deepseek-flash 默认可能开思考链，整理任务关掉以免拖慢/污染 JSON
  if (isDeepSeekFlash(settings.modelName)) {
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
    if (Array.isArray(userContent) && /image|vision|multimodal|不支持|invalid/i.test(errText)) {
      throw new Error(
        `当前模型「${settings.modelName}」未接受图片。识图请使用 deepseek-flash，Base URL 填 https://api.deepseek.com/v1。原始错误：${errText.slice(0, 180)}`,
      )
    }
    throw new Error(`模型请求失败 (${res.status}): ${errText.slice(0, 300)}`)
  }

  const data = await res.json()
  return parseOrganizeResponse(data, manualTitle)
}

function parseOrganizeResponse(
  data: {
    choices?: Array<{
      message?: { content?: string; reasoning_content?: string }
    }>
  },
  fixedTitle?: string,
): { preview: OrganizePreview; mindElixirData: unknown } {
  const message = data.choices?.[0]?.message
  const content = message?.content?.trim() || message?.reasoning_content?.trim()
  if (!content) throw new Error('模型没有返回内容')

  const parsed = extractJson(content) as {
    title?: string
    mindmap?: MindmapTreeNode
    markdown?: string
  }

  if (!parsed.mindmap?.topic && !parsed.title && !fixedTitle) {
    throw new Error('返回 JSON 缺少 mindmap.topic / title')
  }

  const title = (
    fixedTitle ||
    parsed.title ||
    parsed.mindmap?.topic ||
    '未命名'
  ).trim()
  const mindmap: MindmapTreeNode = parsed.mindmap
    ? { ...parsed.mindmap, topic: title }
    : { topic: title, children: [] }

  const preview: OrganizePreview = {
    title,
    mindmap,
    markdown: normalizeMathMarkdown(parsed.markdown || `# ${title}\n`),
  }

  return {
    preview,
    mindElixirData: treeToMindElixir(preview.mindmap),
  }
}

export { treeToMindElixir }
