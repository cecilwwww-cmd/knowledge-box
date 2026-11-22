const palette = ['#49715d', '#526b76', '#765e4f', '#6f647a', '#577558', '#7d606c', '#4c6f72']

export function readGraph(backup) {
  if (!backup || !Array.isArray(backup.nodes)) throw new Error('请选择由知识箱导出的 JSON 备份。')
  const nodes = new Map()
  for (const row of backup.nodes) {
    if (!row || typeof row.id !== 'string' || typeof row.title !== 'string' ||
        !row.id || nodes.has(row.id)) throw new Error('备份中含有无效的节点。')
    nodes.set(row.id, {
      id: row.id, title: row.title || '未命名', parentId: row.parentId,
      sort: Number.isFinite(row.sort) ? row.sort : 0,
      children: [], links: new Map(), sources: [],
    })
  }
  if (!nodes.size) throw new Error('这个备份还没有知识节点。')

  const roots = []
  const edges = []
  function connect(from, to, type) {
    if (from.id === to.id) return
    const link = from.links.get(to.id) ?? {}
    const reverse = to.links.get(from.id) ?? {}
    if (type === 'tree' && link.tree) return
    if (type === 'nav' && link.out) return
    if (type === 'tree') link.tree = reverse.tree = true
    else { link.out = true; reverse.in = true }
    from.links.set(to.id, link)
    to.links.set(from.id, reverse)
    edges.push({ from, to, type })
  }

  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentId)
    if (parent) {
      if (parent === node) throw new Error('备份中有节点指向自身。')
      parent.children.push(node)
      connect(parent, node, 'tree')
    } else roots.push(node)
  }
  const compare = (a, b) => a.sort - b.sort || a.title.localeCompare(b.title)
  roots.sort(compare)
  const clusters = roots.flatMap((root) => root.children.length ? root.children.sort(compare) : [root])
  const clusterIndex = new Map(clusters.map((node, index) => [node.id, index]))
  const visited = new Set()
  const queue = roots.map(node => ({ node, group: clusterIndex.get(node.id) ?? -1, depth: 0 }))
  for (let i = 0; i < queue.length; i++) {
    const { node, group, depth } = queue[i]
    visited.add(node.id)
    node.group = group
    node.depth = depth
    node.color = group < 0 ? '#535b56' : palette[group % palette.length]
    node.children.sort(compare)
    for (const child of node.children) {
      queue.push({ node: child, group: clusterIndex.get(child.id) ?? group, depth: depth + 1 })
    }
  }
  if (visited.size !== nodes.size) throw new Error('备份的目录关系中存在循环。')

  for (const record of Array.isArray(backup.mindmaps) ? backup.mindmaps : []) {
    const from = nodes.get(record?.nodeId)
    const root = record?.data?.nodeData
    if (!from || !root || typeof root !== 'object') continue
    from.mindmap = root
    const pending = [root]
    while (pending.length) {
      const branch = pending.pop()
      const target = nodes.get(branch?.metadata?.kbNodeId)
      if (target) connect(from, target, 'nav')
      if (Array.isArray(branch?.children)) for (const child of branch.children) pending.push(child)
    }
  }
  for (const record of Array.isArray(backup.details) ? backup.details : []) {
    const node = nodes.get(record?.nodeId)
    if (node && typeof record.markdown === 'string') node.markdown = record.markdown
  }
  for (const record of Array.isArray(backup.sources) ? backup.sources : []) {
    const node = nodes.get(record?.nodeId)
    if (node && typeof record.name === 'string') {
      node.sources.push({
        id: record.id, name: record.name, kind: typeof record.kind === 'string' ? record.kind : undefined,
        dataUrl: typeof record.dataUrl === 'string' ? record.dataUrl : undefined,
        category: record.kind === 'image' || String(record.mimeType).startsWith('image/') ? '图片'
          : ['pdf', 'word', 'html', 'text'].includes(record.kind) ? '文档' : '其他文件',
      })
    }
  }
  return { nodes, roots, clusters, edges }
}

export function ancestry(graph, node) {
  const chain = []
  for (let next = node; next; next = graph.nodes.get(next.parentId)) chain.push(next)
  return chain.reverse()
}

export function sampleBackup() {
  const nodes = []
  const put = (id, title, parentId, sort = 0) => nodes.push({ id, title, parentId, sort })
  put('vault', '我的知识库', null)
  const branches = [
    ['study', '双提', [
      ['physics1', '高一物理', ['匀变速运动', '牛顿定律', '受力分析', '曲线运动', '动量与冲量']],
      ['physics2', '高二物理', ['电场强度', '磁感应强度', '电磁感应', '电路分析', '能量守恒']],
    ]],
    ['research', '大四上', [
      ['lab', '研究生横向', ['拉伸实验', '材料制备', '断口分析', '疲劳试验', '金相图谱', '热处理工艺']],
      ['grad', '毕业设计', ['开题报告', '研究方法', '数据处理', '进度记录', '答辩准备']],
    ]],
    ['reading', '阅读笔记', [
      ['literature', '材料文献', ['高温合金综述', '微观组织', '增材制造', '实验标准']],
      ['methods', '写作与方法', ['文献检索', '图表规范', '报告结构', '文献管理']],
    ]],
    ['tools', '工具与方法', [
      ['data', '数据分析', ['应力–应变曲线', '图像标注', '重复性校验', '拟合方法']],
      ['software', '软件笔记', ['知识整理', '笔记模板', '数据备份', '自动化脚本']],
    ]],
  ]
  branches.forEach(([id, title, groups], groupIndex) => {
    put(id, title, 'vault', groupIndex)
    groups.forEach(([section, name, leaves], sectionIndex) => {
      put(section, name, id, sectionIndex)
      leaves.forEach((leaf, index) => put(`${section}-${index}`, leaf, section, index))
    })
  })
  put('inbox', '临时随记', null, 1)
  const makeMap = (nodeId, branches) => ({
    nodeId,
    data: {
      nodeData: { id: 'root', topic: nodes.find(n => n.id === nodeId).title, children: branches.map(([topic, ref], i) => ({
        id: `branch-${i}`, topic, ...(ref && { metadata: { kbNodeId: ref } }),
        ...(topic === '加载与测量' && { note: '在恒定加载速率下记录载荷与位移，结合试样初始尺寸换算应力与应变。' }),
      })) },
    },
  })
  return {
    nodes,
    mindmaps: [
      makeMap('lab-0', [['试样与材料', 'lab-1'], ['曲线与数据', 'data-0'], ['力学试验标准', 'literature-3'], ['加载与测量']]),
      makeMap('lab', [['拉伸实验', 'lab-0'], ['热处理工艺', 'lab-5']]),
      makeMap('physics1-2', [['实验中的受力', 'lab-0']]),
      makeMap('grad-2', [['曲线拟合', 'data-3']]),
      makeMap('literature-0', [['对照项目', 'lab-2']]),
    ],
    details: [
      { nodeId: 'lab-0', markdown: '## 试验概况\n整理金属材料拉伸试验的试样、加载方式与测量方法。\n\n## 记录重点\n- 材料制备与试样尺寸\n- 加载速率和应力–应变曲线\n- 试验标准及结果对照' },
      { nodeId: 'data-0', markdown: '## 曲线与数据\n由原始载荷和位移计算工程应力与应变，对照同组曲线并记录异常点。' },
      { nodeId: 'lab-1', markdown: '## 制备记录\n记录同批试样的加工方向、热处理条件以及测量尺寸。' },
      { nodeId: 'literature-3', markdown: '## 实验标准\n按试验环境对照适用的金属材料试验标准，保留版本号和依据。' },
    ],
    sources: [
      { nodeId: 'lab-0', name: '试样截面.png', kind: 'image' },
      { nodeId: 'lab-0', name: '加载记录.docx', kind: 'word' },
      { nodeId: 'lab-0', name: '应力–应变曲线.png', kind: 'image' },
    ],
  }
}
