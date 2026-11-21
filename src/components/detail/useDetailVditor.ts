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
import { applyRootChrome, exitFullscreen } from './vditorDom'

type Options = {
  markdown: string
  onChange: (markdown: string) => void
  template: DetailTemplateId
  mode: DetailMode
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
}: Options) {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Vditor | null>(null)
  const vditorElRef = useRef<HTMLElement | null>(null)
  const onChangeRef = useRef(onChange)
  const modeRef = useRef(mode)
  const templateRef = useRef(template)

  onChangeRef.current = onChange
  modeRef.current = mode
  templateRef.current = template

  const [toolbarControls, setToolbarControls] = useState<HTMLElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const syncChrome = (root: HTMLElement | null) => {
    applyRootChrome(root, {
      readMode: modeRef.current === 'read',
      template: templateRef.current,
    })
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const root = document.createElement('div')
    root.className = 'detail-vditor'
    host.appendChild(root)
    vditorElRef.current = root
    let cancelled = false
    let observer: MutationObserver | null = null
    let fullscreen = false
    let previousOverflow = ''
    const initial = normalizeMathMarkdown(markdown)

    const syncFullscreen = () => {
      const fs = root.classList.contains('vditor--fullscreen')
      if (fs === fullscreen) return
      fullscreen = fs
      // Moving the editor out of the panel keeps its fixed layout viewport-relative.
      if (fs) document.body.appendChild(root)
      else {
        host.appendChild(root)
        document.body.style.overflow = previousOverflow
      }
      setIsFullscreen(fs)
    }

    const editor = new Vditor(root, {
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
        syncChrome(root)
        const toolbar = root.querySelector('.vditor-toolbar')
        if (toolbar) {
          const frame = document.createElement('div')
          frame.className = 'detail-toolbar-frame'
          toolbar.before(frame)
          frame.appendChild(toolbar)
          const controls = document.createElement('div')
          controls.className = 'detail-toolbar-controls'
          toolbar.prepend(controls)
          setToolbarControls(controls)
        }
        observer = new MutationObserver(syncFullscreen)
        observer.observe(root, {
          attributes: true,
          attributeFilter: ['class'],
        })
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

    const rememberOverflow = (event: Event) => {
      if (
        !fullscreen &&
        event.target instanceof Element &&
        event.target.closest('button[data-type="fullscreen"]')
      ) {
        previousOverflow = document.body.style.overflow
      }
    }
    root.addEventListener('click', rememberOverflow, true)
    root.addEventListener('touchstart', rememberOverflow, true)

    return () => {
      cancelled = true
      observer?.disconnect()
      if (fullscreen) document.body.style.overflow = previousOverflow
      root.remove()
      editorRef.current = null
      vditorElRef.current = null
      try {
        editor.destroy()
      } catch {
        // ignore
      }
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
    syncChrome(vditorElRef.current)
    if (mode === 'read') {
      try {
        editorRef.current?.blur()
      } catch {
        // ignore
      }
    }
  }, [template, mode])

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      exitFullscreen(vditorElRef.current)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isFullscreen])

  return {
    hostRef,
    toolbarControls,
    isFullscreen,
    exitFullscreen: () => exitFullscreen(vditorElRef.current),
  }
}
