import type { DetailTemplateId } from '../db/types'

export type { DetailTemplateId }

export type DetailTemplateMeta = {
  id: DetailTemplateId
  label: string
  hint: string
  /** false = 先占位，暂不提供完整样式 */
  ready: boolean
}

export const DETAIL_TEMPLATES: DetailTemplateMeta[] = [
  {
    id: 'default',
    label: '简洁',
    hint: '清爽默认排版',
    ready: true,
  },
  {
    id: 'textbook',
    label: '教材风',
    hint: '章节色条、编号小节、表格表头',
    ready: true,
  },
  {
    id: 'paper',
    label: '学术风',
    hint: '宋体正文、首行缩进、一、（一）层级、线框表格',
    ready: true,
  },
  {
    id: 'cartoon',
    label: '卡通风',
    hint: '稍后提供',
    ready: false,
  },
]

export function resolveDetailTemplate(
  id: string | undefined | null,
): DetailTemplateId {
  const hit = DETAIL_TEMPLATES.find((t) => t.id === id && t.ready)
  return hit?.id ?? 'default'
}

/** 写入 AI system prompt，约束 Markdown 结构以匹配模板 CSS */
export function detailTemplatePromptGuide(id: DetailTemplateId): string {
  switch (id) {
    case 'textbook':
      return `详细内容必须用 Markdown（不要 HTML/LaTeX 整篇文档），并严格按「教材风」结构书写，便于界面套用教材样式：
1. **必须**以一级标题开头：\`# 节点标题\`（与 JSON 的 title / 目录节点名完全一致；禁止省略一级标题，禁止另起别的一级标题）。
2. 正文从二级开始：\`## 1.1 小节名\`（编号 + 空格 + 标题）。
3. 三级标题写成 \`### 1.1.1 要点名\`；更细可用 \`####\`。正文里不要再出现第二个 \`# \` 一级标题。
4. 日程、对照、分数线等用 Markdown 表格（表头一行 + 分隔行 + 数据行）。
5. 条目用有序/无序列表；补充说明可用引用 \`>\` 或以 \`*\` 开头的短注。
6. 公式只用 \`$...$\` / \`$$...$$\`，不要用方括号包公式。
7. 不要为了好看而输出 HTML 标签或 CSS。`
    case 'paper':
      return `详细内容必须用 Markdown（不要 HTML/LaTeX 整篇文档），并严格按「学术风」结构书写，便于界面套用学术报告样式：
1. **必须**以一级标题开头：\`# 节点标题\`（与 JSON 的 title / 目录节点名完全一致；居中作报告题名；禁止省略）。
2. 一级章节用二级标题，中文序号：\`## 一、引言\`、\`## 二、……\`（也可用 \`## 1. 标题\`，但优先「一、二、三、」）。
3. 二级小节用三级标题：\`### （一）起步阶段\`、\`### （二）……\`。
4. 正文段落写连贯论述；列表仅在必要时使用。表格前可加一行加粗表题，如 \`**表 1 已汇报文献表**\`。
5. 表格用标准 Markdown 表（表头 + 分隔行 + 数据行）。
6. 公式只用 \`$...$\` / \`$$...$$\`。
7. 不要输出 HTML/CSS；正文不要再出现第二个 \`# \` 一级标题。`
    case 'cartoon':
      return `详细内容使用轻松 Markdown：必须首行 \`# 节点标题\`（与 title 一致），其下再短标题分点；公式用 $...$ / $$...$$。禁止省略一级标题。`
    default:
      return `详细内容使用清晰 Markdown：必须首行 \`# 节点标题\`（与 JSON.title 完全一致），其下再用 ## / ### 分层；列表与表格按需；公式用 $...$ / $$...$$。禁止省略一级标题，正文不要再写第二个一级标题。`
  }
}
