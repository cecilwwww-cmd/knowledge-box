import { useEffect, useRef, useState } from 'react'
import Vditor from 'vditor'
import type { DetailTemplateId } from '../../db/types'
import { normalizeMathMarkdown } from '../../lib/normalizeMathMarkdown'
import type { DetailMode } from './types'
import {
  VDITOR_PLACEHOLDER,
  VDITOR_PREVIEW,
  VDITOR_TOOLBAR,
} from './vditorConfig'
import {
  applyRootChrome,
  bindToolbarHover,
  exitFullscreen,
  findVditorRoot,
  mountFullscreen,
  restoreToHost,
  setIrEditable,
} from './vditorDom'

type Options = {
  markdown: string
  onChange: (markdown: string) => void
  template: DetailTemplateId
  mode: DetailMode
  toolbarVisible: boolean
  onToolbarEnter: () => void
  onToolbarLeave: () => void
}

/**
 * Vditor 生命周期：创建、同步 markdown、全屏挂载、根节点 chrome class。
 * UI（箭头 / 阅读按钮）不放这里，方便后续继续叠功能。
 */
export function useDetailVditor({
  markdown,
  onChange,
  template,
  mode,
  toolbarVisible,
  onToolbarEnter,
  onToolbarLeave,
}: Options) {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Vditor | null>(null)
  const vditorElRef = useRef<HTMLElement | null>(null)
  const onChangeRef = useRef(onChange)
  const modeRef = useRef(mode)
  const toolbarVisibleRef = useRef(toolbarVisible)
  const templateRef = useRef(template)
  const onEnterRef = useRef(onToolbarEnter)
  const onLeaveRef = useRef(onToolbarLeave)

  onChangeRef.current = onChange
  modeRef.current = mode
  toolbarVisibleRef.current = toolbarVisible
  templateRef.current = template
  onEnterRef.current = onToolbarEnter
  onLeaveRef.current = onToolbarLeave

  const [isFullscreen, setIsFullscreen] = useState(false)

  const syncChrome = (root: HTMLElement | null) => {
    applyRootChrome(root, {
      toolbarVisible: toolbarVisibleRef.current,
      readMode: modeRef.current === 'read',
      template: templateRef.current,
    })
  }

  useEffect(() => {
    if (!hostRef.current) return
    let cancelled = false
    let observer: MutationObserver | null = null
    const initial = normalizeMathMarkdown(markdown)

    const syncFullscreen = () => {
      const root = vditorElRef.current || findVditorRoot(hostRef.current)
      if (!root) {
        setIsFullscreen(false)
        return
      }
      vditorElRef.current = root
      const fs = root.classList.contains('vditor--fullscreen')
      if (fs) mountFullscreen(root)
      else restoreToHost(hostRef.current, root)
      syncChrome(root)
      bindToolbarHover(
        root,
        () => onEnterRef.current(),
        () => onLeaveRef.current(),
      )
      setIsFullscreen(fs)
    }

    const editor = new Vditor(hostRef.current, {
      height: '100%',
      mode: 'ir',
      value: initial,
      placeholder: VDITOR_PLACEHOLDER,
      cache: { enable: false },
      toolbar: [...VDITOR_TOOLBAR],
      preview: VDITOR_PREVIEW,
      after: () => {
        if (cancelled) {
          editor.destroy()
          return
        }
        editorRef.current = editor
        const root = hostRef.current?.querySelector(
          '.vditor',
        ) as HTMLElement | null
        vditorElRef.current = root
        if (root) {
          observer = new MutationObserver(syncFullscreen)
          observer.observe(root, {
            attributes: true,
            attributeFilter: ['class'],
          })
        }
        syncFullscreen()
        if (initial !== markdown) onChangeRef.current(initial)
      },
      input: (value) => {
        if (modeRef.current === 'read') return
        onChangeRef.current(value)
      },
      blur: () => {
        if (modeRef.current === 'read') return
        onChangeRef.current(editor.getValue())
      },
    })

    return () => {
      cancelled = true
      observer?.disconnect()
      const orphan = vditorElRef.current
      if (orphan?.parentElement === document.body) orphan.remove()
      document.body.style.overflow = ''
      editorRef.current = null
      vditorElRef.current = null
      try {
        editor.destroy()
      } catch {
        // ignore
      }
      if (hostRef.current) hostRef.current.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const next = normalizeMathMarkdown(markdown)
    try {
      if (editor.getValue() !== next) editor.setValue(next, true)
    } catch {
      // ignore
    }
  }, [markdown])

  useEffect(() => {
    const root = vditorElRef.current
    if (!root) return
    root.classList.toggle('kb-read-mode', mode === 'read')
    setIrEditable(root, mode === 'edit')
    if (mode === 'read') {
      try {
        editorRef.current?.blur()
      } catch {
        // ignore
      }
    }
  }, [mode])

  useEffect(() => {
    syncChrome(vditorElRef.current)
  }, [toolbarVisible, isFullscreen, template, mode])

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      exitFullscreen(hostRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  return {
    hostRef,
    vditorElRef,
    isFullscreen,
    exitFullscreen: () => exitFullscreen(hostRef.current),
  }
}
