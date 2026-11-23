import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { appConfig, defaultAppSettings } from '../config'
import { db, defaultMindmap, ensureSeedData } from '../db/database'
import { importBackup } from '../db/importBackup'
import type {
  AppSettings,
  KnowledgeNode,
  OrganizePreview,
  SourceItem,
} from '../db/types'
import { extractFromFile } from '../lib/extractText'
import { ensureLeadingH1 } from '../lib/ensureLeadingH1'
import { normalizeMathMarkdown } from '../lib/normalizeMathMarkdown'
import { runOrganize } from '../lib/organize'
import { runWorkflowStep, type WorkflowReporter } from '../lib/workflowTrace'
import {
  assertNoAncestorPairs,
  commonParentId,
  outlineFromMindElixir,
  runRollupOrganize,
} from '../lib/rollup'

export function useKnowledgeStore() {
  const [ready, setReady] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'sources' | 'mindmap' | 'detail'>(
    'detail',
  )
  const [prompt, setPrompt] = useState('')
  const [organizing, setOrganizing] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    mode: 'organize' | 'rollup'
    preview: OrganizePreview
    mindElixirData: unknown
    prompt: string
    /** 叶子整理或上级归类的目录标题 */
    nodeTitle?: string
    childIds?: string[]
    target?: { id: string; updatedAt: number; markdown: string }
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [classifyMode, setClassifyMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<string[]>([])

  useEffect(() => {
    ensureSeedData()
      .then(async () => {
        // 部署时写入的管理员 DeepSeek 配置：覆盖本机旧设置，保证终端用户共用识图模型
        if (appConfig.lockApiSettings || appConfig.apiKey) {
          const cur = await db.settings.get('main')
          const baked = defaultAppSettings()
          await db.settings.put({
            ...baked,
            // 保留用户选的排版模板，只锁定/注入 API 配置
            detailTemplate: cur?.detailTemplate ?? baked.detailTemplate,
          })
        } else {
          const cur = await db.settings.get('main')
          if (cur && /deepseek-chat|deepseek-reasoner/i.test(cur.modelName)) {
            await db.settings.put({
              ...cur,
              modelName: 'deepseek-flash',
              apiBaseUrl: cur.apiBaseUrl.includes('deepseek')
                ? cur.apiBaseUrl
                : 'https://api.deepseek.com/v1',
              sendImages: true,
            })
          }
        }
        const first = await db.nodes.orderBy('sort').first()
        setSelectedId((id) => id ?? first?.id ?? null)
        setReady(true)
      })
      .catch((e) => setError(String(e)))
  }, [])

  const nodes = useLiveQuery(() => db.nodes.toArray(), []) ?? []
  const storedSettings =
    useLiveQuery(() => db.settings.get('main'), []) ?? defaultAppSettings()
  const settings: AppSettings =
    appConfig.lockApiSettings || appConfig.apiKey
      ? {
          ...storedSettings,
          ...defaultAppSettings(),
          detailTemplate:
            storedSettings.detailTemplate ??
            defaultAppSettings().detailTemplate,
        }
      : storedSettings

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  )

  const sources =
    useLiveQuery(
      () =>
        selectedId
          ? db.sources.where('nodeId').equals(selectedId)
            .filter((source) => source.usage !== 'detail-image').toArray()
          : Promise.resolve([] as SourceItem[]),
      [selectedId],
    ) ?? []

  const detail = useLiveQuery(
    () => (selectedId ? db.details.get(selectedId) : undefined),
    [selectedId],
  )

  const mindmap = useLiveQuery(
    () => (selectedId ? db.mindmaps.get(selectedId) : undefined),
    [selectedId],
  )

  const tree = useMemo(() => buildTree(nodes), [nodes])

  const selectNode = useCallback((id: string, tab?: 'mindmap' | 'detail') => {
    setSelectedId(id)
    if (tab) setActiveTab(tab)
  }, [])

  const addNode = useCallback(
    async (parentId: string | null, title = '新建笔记') => {
      const all = await db.nodes.toArray()
      const siblings = all.filter((n) => n.parentId === parentId).length
      const id = crypto.randomUUID()
      const now = Date.now()
      const node: KnowledgeNode = {
        id,
        parentId,
        title,
        sort: siblings,
        updatedAt: now,
      }
      await db.nodes.add(node)
      await db.mindmaps.put({
        nodeId: id,
        data: defaultMindmap(title),
        updatedAt: now,
      })
      await db.details.put({
        nodeId: id,
        markdown: `# ${title}\n\n`,
        updatedAt: now,
      })
      setSelectedId(id)
      setActiveTab('detail')
      return id
    },
    [],
  )

  const renameNode = useCallback(async (id: string, title: string) => {
    await db.nodes.update(id, { title, updatedAt: Date.now() })
  }, [])

  const deleteNode = useCallback(
    async (id: string) => {
      const all = await db.nodes.toArray()
      const toDelete = collectDescendants(all, id)
      await db.transaction(
        'rw',
        db.nodes,
        db.sources,
        db.mindmaps,
        db.details,
        db.snapshots,
        async () => {
          await db.nodes.bulkDelete(toDelete)
          for (const nid of toDelete) {
            await db.sources.where('nodeId').equals(nid).delete()
            await db.mindmaps.delete(nid)
            await db.details.delete(nid)
            await db.snapshots.where('nodeId').equals(nid).delete()
          }
        },
      )
      if (selectedId && toDelete.includes(selectedId)) {
        const remaining = all.filter((n) => !toDelete.includes(n.id))
        setSelectedId(remaining[0]?.id ?? null)
      }
    },
    [selectedId],
  )

  /** 只删直接/全部子孙，保留当前节点本身（用于清掉误生成的下级目录） */
  const deleteChildNodes = useCallback(
    async (id: string) => {
      const all = await db.nodes.toArray()
      const kids = all.filter((n) => n.parentId === id)
      if (!kids.length) return
      const toDelete = kids.flatMap((k) => collectDescendants(all, k.id))
      await db.transaction(
        'rw',
        db.nodes,
        db.sources,
        db.mindmaps,
        db.details,
        db.snapshots,
        async () => {
          await db.nodes.bulkDelete(toDelete)
          for (const nid of toDelete) {
            await db.sources.where('nodeId').equals(nid).delete()
            await db.mindmaps.delete(nid)
            await db.details.delete(nid)
            await db.snapshots.where('nodeId').equals(nid).delete()
          }
        },
      )
      if (selectedId && toDelete.includes(selectedId)) {
        setSelectedId(id)
      }
    },
    [selectedId],
  )

  /**
   * 取消归类：解散本级父节点，子节点上移到原父级位置，不删除子节点内容。
   */
  const cancelRollup = useCallback(
    async (id: string) => {
      const all = await db.nodes.toArray()
      const node = all.find((n) => n.id === id)
      if (!node) return
      const kids = all
        .filter((n) => n.parentId === id)
        .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title))
      if (!kids.length) {
        setError('该节点没有子节点，无法取消归类')
        return
      }

      const grandparentId = node.parentId
      const siblings = all
        .filter((n) => n.parentId === grandparentId && n.id !== id)
        .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title))

      // 用子节点替换本节点在同级中的位置
      const insertAt = (() => {
        const before = siblings.filter((s) => s.sort < node.sort).length
        return before
      })()
      const reordered = [
        ...siblings.slice(0, insertAt),
        ...kids,
        ...siblings.slice(insertAt),
      ]
      const now = Date.now()

      await db.transaction(
        'rw',
        db.nodes,
        db.sources,
        db.mindmaps,
        db.details,
        db.snapshots,
        async () => {
          for (let i = 0; i < reordered.length; i++) {
            const n = reordered[i]
            await db.nodes.update(n.id, {
              parentId: grandparentId,
              sort: i,
              updatedAt: now,
            })
          }
          await db.nodes.delete(id)
          await db.sources.where('nodeId').equals(id).delete()
          await db.mindmaps.delete(id)
          await db.details.delete(id)
          await db.snapshots.where('nodeId').equals(id).delete()
        },
      )

      if (selectedId === id) {
        setSelectedId(kids[0]?.id ?? grandparentId)
      }
    },
    [selectedId],
  )

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!selectedId) return
      const list = Array.from(files)
      setError(null)
      setParsing(true)
      setActiveTab('sources')
      try {
        for (const file of list) {
          try {
            setStatus(`正在解析：${file.name}…`)
            const extracted = await extractFromFile(file, (msg) => setStatus(msg))
            await db.sources.add({
              id: crypto.randomUUID(),
              nodeId: selectedId,
              name: file.name,
              mimeType: file.type || 'application/octet-stream',
              textContent: extracted.textContent,
              dataUrl: extracted.dataUrl,
              kind: extracted.kind,
              size: file.size,
              createdAt: Date.now(),
            })
            setStatus(`已加入原料：${file.name}（${extracted.kind}）`)
          } catch (e) {
            setError(
              e instanceof Error
                ? `解析「${file.name}」失败：${e.message}`
                : `解析「${file.name}」失败`,
            )
            setStatus(null)
          }
        }
      } finally {
        setParsing(false)
        window.setTimeout(() => setStatus(null), 2500)
      }
    },
    [selectedId],
  )

  const removeSource = useCallback(async (id: string) => {
    await db.sources.delete(id)
  }, [])

  const saveDetail = useCallback(async (markdown: string) => {
    if (!selectedId) return
    await db.details.put({
      nodeId: selectedId,
      markdown: normalizeMathMarkdown(markdown),
      updatedAt: Date.now(),
    })
    await db.nodes.update(selectedId, { updatedAt: Date.now() })
  }, [selectedId])

  const saveDetailFor = useCallback(async (nodeId: string, markdown: string) => {
    await db.details.put({
      nodeId,
      markdown: normalizeMathMarkdown(markdown),
      updatedAt: Date.now(),
    })
    await db.nodes.update(nodeId, { updatedAt: Date.now() })
  }, [])

  const saveMindmap = useCallback(
    async (data: unknown) => {
      if (!selectedId) return
      await db.mindmaps.put({
        nodeId: selectedId,
        data,
        updatedAt: Date.now(),
      })
      await db.nodes.update(selectedId, { updatedAt: Date.now() })
    },
    [selectedId],
  )

  const saveSettings = useCallback(async (next: AppSettings) => {
    await db.settings.put(next)
  }, [])

  const startOrganize = useCallback(
    async (opts?: { titleMode?: 'ai' | 'manual'; manualTitle?: string }, report?: WorkflowReporter) => {
      if (!selected) return
      if (parsing) {
        setError('文件还在解析中，请稍后再点「开始整理」')
        return
      }
      const titleMode = opts?.titleMode ?? 'ai'
      const manualTitle = opts?.manualTitle?.trim()
      if (titleMode === 'manual' && !manualTitle) {
        setError('请先填写标题，或改选「AI 总结标题」')
        return
      }
      setOrganizing(true)
      setError(null)
      try {
        const [currentSources, target, currentDetail] = await runWorkflowStep(report, 'read', '读取当前笔记与原料', () => Promise.all([db.sources
          .where('nodeId')
          .equals(selected.id)
          .filter((source) => source.usage !== 'detail-image')
          .toArray(), db.nodes.get(selected.id), db.details.get(selected.id)]),
          ([sources]) => `${selected.title} · ${sources.length} 份原料`)
        if (!target) throw new Error('当前笔记已不存在。')
        if (!currentSources.length) {
          throw new Error(
            '当前节点还没有原料。请先拖入图片/PDF/Word/HTML，等「原料」页出现内容后再整理。',
          )
        }
        const hasVisionReady = currentSources.some(
          (s) => s.kind === 'image' && !!s.dataUrl,
        )
        const weak = currentSources.filter(
          (s) =>
            !(s.kind === 'image' && s.dataUrl) &&
            /暂不解析|未提取到|未识别出/i.test(s.textContent) &&
            s.textContent.length < 80,
        )
        if (!hasVisionReady && weak.length === currentSources.length) {
          throw new Error(
            '原料未能提取出有效正文（可能是旧数据）。请删掉原料后重新拖入文件再试。',
          )
        }
        setStatus(
          titleMode === 'manual'
            ? `正在按标题「${manualTitle}」整理…`
            : settings.sendImages !== false && hasVisionReady
              ? '正在识图并总结标题…'
              : '正在总结标题并整理…',
        )
        const result = await runOrganize({
          settings,
          nodeTitle: selected.title,
          prompt,
          sources: currentSources,
          existingMarkdown: currentDetail?.markdown,
          report,
          fixedTitle: titleMode === 'manual' ? manualTitle : undefined,
        })
        setPreview({
          mode: 'organize',
          ...result,
          prompt,
          nodeTitle: result.preview.title || manualTitle || selected.title,
          target: { id: target.id, updatedAt: target.updatedAt, markdown: currentDetail?.markdown ?? '' },
        })
        report?.({ id: 'review', label: '等待确认方案', state: 'waiting' })
        setStatus(null)
      } catch (e) {
        report?.({ id: 'result', label: '未能生成整理方案', state: 'failed' })
        setError(e instanceof Error ? e.message : String(e))
        setStatus(null)
      } finally {
        setOrganizing(false)
      }
    },
    [selected, settings, prompt, parsing],
  )

  const toggleClassifyMode = useCallback(() => {
    setClassifyMode((v) => {
      if (v) setCheckedIds([])
      return !v
    })
  }, [])

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const clearChecked = useCallback(() => setCheckedIds([]), [])

  const startRollup = useCallback(
    async (opts?: { titleMode?: 'ai' | 'manual'; manualTitle?: string }, report?: WorkflowReporter) => {
      if (checkedIds.length < 2) {
        setError('请至少勾选 2 个节点')
        return
      }
      const titleMode = opts?.titleMode ?? 'ai'
      const manualTitle = opts?.manualTitle?.trim()
      if (titleMode === 'manual' && !manualTitle) {
        setError('请先填写上级节点标题，或改选「AI 总结标题」')
        return
      }
      setOrganizing(true)
      setError(null)
      try {
        const children = await runWorkflowStep(report, 'read', '读取勾选节点的正文和导图', async () => {
          const all = await db.nodes.toArray()
          assertNoAncestorPairs(all, checkedIds)
          return Promise.all(checkedIds.map(async (id) => {
            const node = all.find((n) => n.id === id)
            if (!node) throw new Error('有勾选的节点已不存在，请重新选择。')
            const [detail, map] = await Promise.all([db.details.get(id), db.mindmaps.get(id)])
            return { id, title: node.title, markdown: detail?.markdown ?? '', mindmapOutline: outlineFromMindElixir(map?.data) }
          }))
        }, (items) => `${items.length} 个节点`)
        setStatus(
          titleMode === 'manual'
            ? `正在按标题「${manualTitle}」生成概况与总览导图…`
            : '正在总结标题并生成上级概况与总览导图…',
        )
        const result = await runWorkflowStep(report, 'model', '调用模型生成归类方案', () => runRollupOrganize({
          settings,
          children,
          prompt,
          fixedTitle: titleMode === 'manual' ? manualTitle : undefined,
        }), () => settings.modelName)
        setPreview({
          mode: 'rollup',
          preview: result.preview,
          mindElixirData: result.mindElixirData,
          prompt,
          nodeTitle: result.title,
          childIds: children.map((c) => c.id),
        })
        report?.({ id: 'review', label: '等待确认方案', state: 'waiting' })
        setStatus(null)
      } catch (e) {
        report?.({ id: 'result', label: '未能生成归类方案', state: 'failed' })
        setError(e instanceof Error ? e.message : String(e))
        setStatus(null)
      } finally {
        setOrganizing(false)
      }
    },
    [checkedIds, settings, prompt],
  )

  const applyPreview = useCallback(
    async (opts: { mindmap: boolean; detail: boolean; title?: string }) => {
      if (!preview) return
      const now = Date.now()

      if (preview.mode === 'rollup' && preview.childIds?.length) {
        const all = await db.nodes.toArray()
        const childIds = preview.childIds
        assertNoAncestorPairs(all, childIds)
        const parentOfGroup = commonParentId(all, childIds)
        const siblings = all.filter((n) => n.parentId === parentOfGroup)
        const title = (
          opts.title?.trim() ||
          preview.nodeTitle ||
          preview.preview.mindmap.topic
        ).trim()
        const parentId = crypto.randomUUID()
        const mindData = opts.mindmap
          ? patchMindElixirTopic(preview.mindElixirData, title)
          : defaultMindmap(title)

        await db.transaction(
          'rw',
          db.nodes,
          db.mindmaps,
          db.details,
          async () => {
            await db.nodes.add({
              id: parentId,
              parentId: parentOfGroup,
              title,
              sort: siblings.length ? Math.min(...siblings.map((s) => s.sort)) : 0,
              updatedAt: now,
              origin: 'rollup',
            })
            // 把勾选节点挪到新父节点下，保持相对顺序
            const ordered = [...childIds].sort((a, b) => {
              const na = all.find((n) => n.id === a)
              const nb = all.find((n) => n.id === b)
              return (na?.sort ?? 0) - (nb?.sort ?? 0)
            })
            let i = 0
            for (const cid of ordered) {
              await db.nodes.update(cid, {
                parentId,
                sort: i++,
                updatedAt: now,
              })
            }
            await db.mindmaps.put({
              nodeId: parentId,
              data: mindData,
              updatedAt: now,
            })
            if (opts.detail) {
              await db.details.put({
                nodeId: parentId,
                markdown: ensureLeadingH1(
                  normalizeMathMarkdown(preview.preview.markdown),
                  title,
                ),
                updatedAt: now,
              })
            } else {
              await db.details.put({
                nodeId: parentId,
                markdown: `# ${title}\n\n`,
                updatedAt: now,
              })
            }
          },
        )

        setPreview(null)
        setCheckedIds([])
        setClassifyMode(false)
        setSelectedId(parentId)
        setActiveTab(opts.detail ? 'detail' : 'mindmap')
        return
      }

      const target = preview.target
      if (!target) throw new Error('找不到这次整理的目标笔记，请重新生成方案。')
      await db.transaction('rw', [db.nodes, db.details, db.mindmaps, db.snapshots], async () => {
        const current = await db.nodes.get(target.id)
        const detailBefore = await db.details.get(target.id)
        if (!current || current.updatedAt !== target.updatedAt || (detailBefore?.markdown ?? '') !== target.markdown) {
          throw new Error('原笔记在生成方案后已改动，请取消当前方案并重新整理。')
        }
        const title = (opts.title?.trim() || preview.nodeTitle || preview.preview.title || current.title).trim()
        const previousMindmap = await db.mindmaps.get(target.id)
        await db.snapshots.add({
          id: crypto.randomUUID(),
          nodeId: target.id,
          mindmap: previousMindmap?.data ?? null,
          markdown: detailBefore?.markdown ?? '',
          prompt: preview.prompt,
          createdAt: now,
        })
        if (opts.mindmap) {
          await db.mindmaps.put({
            nodeId: target.id,
            data: patchMindElixirTopic(preview.mindElixirData, title),
            updatedAt: now,
          })
        }
        if (opts.detail) {
          await db.details.put({
            nodeId: target.id,
            markdown: ensureLeadingH1(normalizeMathMarkdown(preview.preview.markdown), title),
            updatedAt: now,
          })
        }
        await db.nodes.update(target.id, { title, updatedAt: now })
      })
      setSelectedId(target.id)
      setPreview(null)
      setActiveTab(opts.detail ? 'detail' : 'mindmap')
    },
    [preview],
  )

  const exportBackup = useCallback(async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      nodes: await db.nodes.toArray(),
      sources: await db.sources.toArray(),
      mindmaps: await db.mindmaps.toArray(),
      details: await db.details.toArray(),
      snapshots: await db.snapshots.toArray(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `knowledge-box-backup-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const restoreBackup = useCallback(async (file: File) => {
    setError('')
    try {
      const count = await importBackup(file)
      setStatus(`备份导入完成，新增 ${count} 个笔记节点。`)
    } catch (cause) {
      setError(cause instanceof SyntaxError
        ? '备份不是有效的 JSON 文件。'
        : cause instanceof Error ? cause.message : '导入备份失败。')
    }
  }, [])

  return {
    ready,
    error,
    setError,
    tree,
    nodes,
    selected,
    selectedId,
    selectNode,
    activeTab,
    setActiveTab,
    sources,
    detail,
    mindmap,
    prompt,
    setPrompt,
    organizing,
    parsing,
    status,
    preview,
    setPreview,
    showSettings,
    setShowSettings,
    settings,
    saveSettings,
    addNode,
    renameNode,
    deleteNode,
    deleteChildNodes,
    cancelRollup,
    addFiles,
    removeSource,
    saveDetail,
    saveDetailFor,
    saveMindmap,
    startOrganize,
    applyPreview,
    exportBackup,
    restoreBackup,
    classifyMode,
    toggleClassifyMode,
    checkedIds,
    toggleChecked,
    clearChecked,
    startRollup,
  }
}

export type TreeNode = KnowledgeNode & { children: TreeNode[] }

function patchMindElixirTopic(data: unknown, title: string): unknown {
  if (!data || typeof data !== 'object') return defaultMindmap(title)
  const cloned = structuredClone(data) as { nodeData?: { topic?: string } }
  if (cloned.nodeData) cloned.nodeData.topic = title
  return cloned
}

function buildTree(nodes: KnowledgeNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  nodes.forEach((n) => map.set(n.id, { ...n, children: [] }))
  const roots: TreeNode[] = []
  for (const n of map.values()) {
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(n)
    } else {
      roots.push(n)
    }
  }
  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title))
    list.forEach((c) => sortRec(c.children))
  }
  sortRec(roots)
  return roots
}

function collectDescendants(all: KnowledgeNode[], rootId: string): string[] {
  const result = [rootId]
  const queue = [rootId]
  while (queue.length) {
    const id = queue.shift()!
    for (const n of all) {
      if (n.parentId === id) {
        result.push(n.id)
        queue.push(n.id)
      }
    }
  }
  return result
}
