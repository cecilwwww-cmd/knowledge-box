import { useEffect, useRef, useState } from 'react'
import Vditor from 'vditor'
import {
  detailImageRef,
  isDetailImageFile,
  migrateEmbeddedDetailImages,
  mountDetailImages,
  saveDetailImages,
} from '../../db/detailImages'
import type { DetailTemplateId } from '../../db/types'
import { filesFromClipboard } from '../../lib/clipboardFiles'
import { normalizeMathMarkdown } from '../../lib/normalizeMathMarkdown'
import type { DetailMode } from './types'
import {
  VDITOR_PLACEHOLDER,
  VDITOR_PREVIEW,
  VDITOR_TOOLBAR,
} from './vditorConfig'
import { applyRootChrome, exitFullscreen, showSourceReferences } from './vditorDom'

type Options = {
  nodeId: string
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
  nodeId,
  markdown,
  onChange,
  template,
  mode,
}: Options) {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Vditor | null>(null)
  const vditorElRef = useRef<HTMLElement | null>(null)
  const onChangeRef = useRef(onChange)
  const markdownRef = useRef(markdown)
  const modeRef = useRef(mode)
  const templateRef = useRef(template)

  onChangeRef.current = onChange
  markdownRef.current = markdown
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
  const syncReferences = (root: HTMLElement | null) => {
    showSourceReferences(root, templateRef.current === 'default' && modeRef.current === 'read')
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
    let disposeImages: (() => void) | undefined
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
      ...(window.location.protocol === 'kb:' && { cdn: 'kb://local/vendor/vditor' }),
      toolbar: [...VDITOR_TOOLBAR],
      preview: VDITOR_PREVIEW,
      upload: { multiple: true, handler: handleImages },
      after: () => {
        if (cancelled) {
          editor.destroy()
          return
        }
        editorRef.current = editor
        syncChrome(root)
        disposeImages = mountDetailImages(root)
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
        const current = markdownRef.current
        const next = normalizeMathMarkdown(current)
        if (editor.getValue() !== next) editor.setValue(next, true)
        syncReferences(root)
        if (next !== current) onChangeRef.current(next)
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

    const isReadMode = () => modeRef.current === 'read'

    async function insertImages(files: File[]) {
      if (isReadMode()) return
      const selection = window.getSelection()
      const range = selection?.rangeCount && root.contains(selection.anchorNode)
        ? selection.getRangeAt(0).cloneRange()
        : undefined
      try {
        const images = await saveDetailImages(nodeId, files)
        if (!images.length) return '请选择浏览器支持的图片文件。'
        if (cancelled || isReadMode()) return
        if (range && root.contains(range.commonAncestorContainer)) {
          selection?.removeAllRanges()
          selection?.addRange(range)
        }
        editor.insertMD(images.map(({ id, name }) =>
          `![${name.replace(/[\\[\]\r\n]/g, ' ')}](${detailImageRef(id)})`,
        ).join('\n\n'))
        onChangeRef.current(editor.getValue())
      } catch {
        return '图片未能保存，请重试。'
      }
    }

    async function handleImages(files: File[]): Promise<null> {
      const error = await insertImages(files)
      if (error && !cancelled) editor.tip(error)
      return null
    }

    const interceptImagePaste = (event: ClipboardEvent) => {
      const target = event.target
      if (modeRef.current === 'read' || !(target instanceof HTMLElement) || !target.isContentEditable) return
      const clipboard = event.clipboardData
      if (!clipboard) return
      const plain = clipboard.getData('text/plain').trim()
      // Leave rich text with surrounding words to the normal Markdown paste.
      if (clipboard.getData('text/html') && plain && !/^https?:\/\/\S+$/.test(plain)) return
      const files = filesFromClipboard(clipboard).filter(isDetailImageFile)
      if (!files.length) return
      event.preventDefault()
      event.stopPropagation()
      void handleImages(files)
    }
    root.addEventListener('paste', interceptImagePaste, true)

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
      disposeImages?.()
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
    void migrateEmbeddedDetailImages(nodeId, markdown).catch(console.error)
  }, [nodeId, markdown])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const next = normalizeMathMarkdown(markdown)
    try {
      if (modeRef.current === 'read') showSourceReferences(vditorElRef.current, false)
      if (editor.getValue() !== next) editor.setValue(next, true)
      if (modeRef.current === 'read') syncReferences(vditorElRef.current)
    } catch {
      // ignore
    }
  }, [markdown])

  useEffect(() => {
    syncChrome(vditorElRef.current)
    syncReferences(vditorElRef.current)
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
