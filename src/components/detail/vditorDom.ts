import type { DetailTemplateId } from '../../db/types'
import { DETAIL_TPL_IDS } from './types'

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
    readMode: boolean
    template: DetailTemplateId
  },
) {
  if (!root) return
  root.classList.toggle('kb-read-mode', opts.readMode)
  applyTemplateClass(root, opts.template)
  setIrEditable(root, !opts.readMode)
}

export function exitFullscreen(root: HTMLElement | null) {
  if (!root?.classList.contains('vditor--fullscreen')) return
  const button = root.querySelector<HTMLButtonElement>(
    'button[data-type="fullscreen"]',
  )
  // Vditor binds the fullscreen toggle to touchstart on iPhone.
  if (navigator.userAgent.includes('iPhone')) {
    button?.dispatchEvent(
      new Event('touchstart', { bubbles: true, cancelable: true }),
    )
  } else {
    button?.click()
  }
}
