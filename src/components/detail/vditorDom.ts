import type { DetailTemplateId } from '../../db/types'
import { DETAIL_TPL_IDS } from './types'

/** 在 host 内或挂到 body 的全屏根上查找 .vditor */
export function findVditorRoot(host: HTMLElement | null) {
  return (
    (host?.querySelector('.vditor') as HTMLElement | null) ||
    (document.querySelector('body > .vditor') as HTMLElement | null)
  )
}

export function setIrEditable(root: HTMLElement | null, editable: boolean) {
  const pre = root?.querySelector(
    '.vditor-ir pre.vditor-reset',
  ) as HTMLElement | null
  if (!pre) return
  pre.setAttribute('contenteditable', editable ? 'true' : 'false')
  pre.style.caretColor = editable ? '' : 'transparent'
}

export function applyTemplateClass(
  root: HTMLElement,
  tpl: DetailTemplateId,
) {
  for (const id of DETAIL_TPL_IDS) {
    root.classList.toggle(`kb-tpl-${id}`, id === tpl)
  }
}

export function applyRootChrome(
  root: HTMLElement | null,
  opts: {
    toolbarVisible: boolean
    readMode: boolean
    template: DetailTemplateId
  },
) {
  if (!root) return
  root.classList.toggle('kb-toolbar-visible', opts.toolbarVisible)
  root.classList.toggle('kb-read-mode', opts.readMode)
  applyTemplateClass(root, opts.template)
  setIrEditable(root, !opts.readMode)
}

/** 全屏时挂到 body，避免祖先 transform 困住 fixed */
export function mountFullscreen(root: HTMLElement) {
  if (root.parentElement !== document.body) {
    document.body.appendChild(root)
  }
  document.body.style.overflow = 'hidden'
}

export function restoreToHost(host: HTMLElement | null, root: HTMLElement) {
  if (!host) return
  if (root.parentElement !== host) host.appendChild(root)
  root.style.zIndex = ''
  root.style.position = ''
  root.style.inset = ''
  root.style.width = ''
  root.style.height = ''
  document.body.style.overflow = ''
}

export function exitFullscreen(host: HTMLElement | null) {
  const root =
    (document.querySelector('.vditor--fullscreen') as HTMLElement | null) ||
    findVditorRoot(host)
  if (!root) return
  if (root.classList.contains('vditor--fullscreen')) {
    const btn = root.querySelector(
      '[data-type="fullscreen"]',
    ) as HTMLElement | null
    if (btn) {
      btn.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
    } else {
      root.classList.remove('vditor--fullscreen')
    }
  }
  restoreToHost(host, root)
}

export function bindToolbarHover(
  root: HTMLElement | null,
  onEnter: () => void,
  onLeave: () => void,
) {
  if (!root) return
  const toolbar = root.querySelector('.vditor-toolbar') as HTMLElement | null
  if (!toolbar || toolbar.dataset.kbHoverBound) return
  toolbar.dataset.kbHoverBound = '1'
  toolbar.addEventListener('mouseenter', onEnter)
  toolbar.addEventListener('mouseleave', onLeave)
}
