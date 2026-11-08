import type { Theme } from 'mind-elixir'
import type { MainLineParams, SubLineParams } from 'mind-elixir'

/**
 * 教材逻辑图式审美（左→右、分色主干、直角连线）
 * 参考：总线/仲裁类知识框图，避免默认「AI 气球导图」感
 */
export const TEXTBOOK_MINDMAP_THEME: Theme = {
  name: 'TextbookLogic',
  type: 'light',
  // 自上而下：蓝 → 靛 → 紫 → 玫红，循环用于一级分支
  palette: [
    '#3B6FD9',
    '#4B4FBF',
    '#7A4DB8',
    '#B03E8C',
    '#2F7D6D',
    '#C45C26',
  ],
  cssVar: {
    '--bgcolor': '#F7F8FA',
    '--color': '#2A2F3A',
    '--main-color': '#2A2F3A',
    '--main-bgcolor': '#FFFFFF',
    '--main-bgcolor-transparent': 'rgba(255,255,255,0.92)',
    '--root-color': '#1A1F2C',
    '--root-bgcolor': '#FFFFFF',
    '--root-border-color': '#1A1F2C',
    '--root-radius': '6px',
    '--main-radius': '8px',
    '--selected': '#3B6FD9',
    '--accent-color': '#3B6FD9',
    '--panel-color': '#2A2F3A',
    '--panel-bgcolor': '#FFFFFF',
    '--panel-border-color': '#E4E7EC',
    '--map-padding': '48px',
    '--main-gap-x': '36px',
    '--main-gap-y': '18px',
    '--node-gap-x': '18px',
    '--node-gap-y': '6px',
    '--topic-padding': '4px 8px',
  },
  generateMainBranch,
  generateSubBranch,
}

/** 直角折线：父中点 → 中线 → 子中点（教材框图常用） */
function generateMainBranch({
  pT,
  pL,
  pW,
  pH,
  cT,
  cL,
  cW,
  cH,
  direction,
}: MainLineParams): string {
  const y1 = pT + pH / 2
  const y2 = cT + cH / 2
  const isLeft = String(direction) === 'lhs'
  const x1 = isLeft ? pL : pL + pW
  const x2 = isLeft ? cL + cW : cL
  const mid = x1 + (x2 - x1) * 0.45
  return `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`
}

function generateSubBranch({
  pT,
  pL,
  pW,
  pH,
  cT,
  cL,
  cW,
  cH,
  direction,
}: SubLineParams): string {
  const y1 = pT + pH / 2
  const y2 = cT + cH / 2
  const isLeft = String(direction) === 'lhs'
  const x1 = isLeft ? pL : pL + pW
  const x2 = isLeft ? cL + cW : cL
  // 叶子侧略贴近「下划线」：先水平到子节点左缘附近再折
  const mid = x1 + (x2 - x1) * 0.55
  return `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`
}

export { generateMainBranch, generateSubBranch }
