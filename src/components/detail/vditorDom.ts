import type { GraphHeading } from '../../../prototypes/knowledge-graph/model.js'
import type { DetailTemplateId } from '../../db/types'
import { DETAIL_TPL_IDS } from './types'

export function jumpToHeading(root: HTMLElement, { level, index }: GraphHeading) {
  const headings = root.querySelectorAll<HTMLElement>(`.vditor-ir .vditor-reset > h${level}`)
  const heading = headings[index]
  if (!heading) return false
  heading.scrollIntoView({ block: 'start', inline: 'nearest' })
  heading.getAnimations().find(animation => animation.id === 'kb-heading-jump')?.cancel()
  const highlight = heading.animate(
    [{ backgroundColor: 'rgba(103, 168, 139, .28)' }, { backgroundColor: 'transparent' }],
    { duration: 1100, easing: 'ease-out' },
  )
  highlight.id = 'kb-heading-jump'
  return true
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
    readMode: boolean
    template: DetailTemplateId
  },
) {
  if (!root) return
  root.classList.toggle('kb-read-mode', opts.readMode)
  applyTemplateClass(root, opts.template)
  setIrEditable(root, !opts.readMode)
}

export function showSourceReferences(root: HTMLElement | null, enabled: boolean) {
  const content = root?.querySelector('.vditor-ir pre.vditor-reset')
  if (!content) return
  if (!enabled) {
    content.querySelectorAll('.detail-source-ref').forEach((item) => {
      const parent = item.parentElement
      item.replaceWith(document.createTextNode(item.textContent || ''))
      parent?.normalize()
    })
    return
  }

  const pattern = /\[来源\s*(\d+)\]/g
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
  const candidates: Text[] = []
  while (walker.nextNode()) {
    const text = walker.currentNode as Text
    if (text.data.includes('[来源') &&
        !text.parentElement?.closest('.detail-source-ref, code, .vditor-ir__marker, .vditor-ir__node, a')) {
      candidates.push(text)
    }
  }
  for (const node of candidates) {
    const fragment = document.createDocumentFragment()
    let offset = 0
    for (const match of node.data.matchAll(pattern)) {
      const index = match.index
      fragment.append(node.data.slice(offset, index))
      const badge = document.createElement('span')
      badge.className = 'detail-source-ref'
      badge.dataset.label = `来源${match[1]}`
      badge.textContent = match[0]
      fragment.append(badge)
      offset = index + match[0].length
    }
    if (offset) {
      fragment.append(node.data.slice(offset))
      node.replaceWith(fragment)
    }
  }
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
