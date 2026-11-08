import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { appConfig, defaultAppSettings } from '../config'
import { db, defaultMindmap, ensureSeedData } from '../db/database'
import type {
  AppSettings,
  KnowledgeNode,
  OrganizePreview,
  SourceItem,
} from '../db/types'
import { extractFromFile } from '../lib/extractText'
import { normalizeMathMarkdown } from '../lib/normalizeMathMarkdown'
import { runOrganize } from '../lib/organize'

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
    preview: OrganizePreview
    mindElixirData: unknown
    prompt: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    ensureSeedData()
      .then(async () => {
        // 部署时写入的管理员 DeepSeek 配置：覆盖本机旧设置，保证终端用户共用识图模型
        if (appConfig.lockApiSettings || appConfig.apiKey) {
          await db.settings.put(defaultAppSettings())
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
          ? db.sources.where('nodeId').equals(selectedId).toArray()
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

  const startOrganize = useCallback(async () => {
    if (!selected) return
    if (parsing) {
      setError('文件还在解析中，请稍后再点「开始整理」')
      return
    }
    setOrganizing(true)
    setError(null)
    try {
      const currentSources = await db.sources
        .where('nodeId')
        .equals(selected.id)
        .toArray()
      if (!currentSources.length) {
        throw new Error('当前节点还没有原料。请先拖入图片/PDF/Word/HTML，等「原料」页出现内容后再整理。')
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
        settings.sendImages !== false && hasVisionReady
          ? '正在发送原图给识图模型…'
          : '正在调用模型整理…',
      )
      const result = await runOrganize({
        settings,
        nodeTitle: selected.title,
        prompt,
        sources: currentSources,
        existingMarkdown: detail?.markdown,
      })
      setPreview({ ...result, prompt })
      setStatus(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus(null)
    } finally {
      setOrganizing(false)
    }
  }, [selected, settings, prompt, detail?.markdown, parsing])

  const applyPreview = useCallback(
    async (opts: { mindmap: boolean; detail: boolean; children: boolean }) => {
      if (!selected || !preview) return
      const now = Date.now()
      await db.snapshots.add({
        id: crypto.randomUUID(),
        nodeId: selected.id,
        mindmap: mindmap?.data ?? null,
        markdown: detail?.markdown ?? '',
        prompt: preview.prompt,
        createdAt: now,
      })

      if (opts.mindmap) {
        await db.mindmaps.put({
          nodeId: selected.id,
          data: preview.mindElixirData,
          updatedAt: now,
        })
      }
      if (opts.detail) {
        await db.details.put({
          nodeId: selected.id,
          markdown: normalizeMathMarkdown(preview.preview.markdown),
          updatedAt: now,
        })
      }
      if (opts.children && preview.preview.suggestedChildren?.length) {
        for (const title of preview.preview.suggestedChildren) {
          await addNode(selected.id, title)
        }
      }
      await db.nodes.update(selected.id, { updatedAt: now })
      setPreview(null)
      setActiveTab(opts.detail ? 'detail' : 'mindmap')
    },
    [selected, preview, mindmap?.data, detail?.markdown, addNode],
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
    addFiles,
    removeSource,
    saveDetail,
    saveMindmap,
    startOrganize,
    applyPreview,
    exportBackup,
  }
}

export type TreeNode = KnowledgeNode & { children: TreeNode[] }

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
