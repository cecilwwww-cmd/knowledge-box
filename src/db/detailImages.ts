import { db } from './database'
import type { SourceItem } from './types'

const rasterMime = 'image/(?:png|jpeg|gif|webp|bmp|avif|x-icon|vnd\\.microsoft\\.icon)'
const rasterType = new RegExp(`^${rasterMime}$`, 'i')
const dataImage = new RegExp(`^data:(${rasterMime});base64,([a-z0-9+/]+={0,2})$`, 'i')
const reference = /^#kb-image-([0-9a-f-]{36})$/i
const markdownImage = /(`+)[^`]*?\1|(!\[((?:\\.|[^\]\\])*)\]\(<?)(data:image\/[-a-z0-9.+]+;base64,[a-z0-9+/]+={0,2})(?=>?(?:\s|\)))/gi

export const detailImageRef = (id: string) => `#kb-image-${id}`
export const isDetailImageFile = (file: File) => rasterType.test(file.type) && file.size > 0

function imageSource(nodeId: string, alt: string, dataUrl: string, mimeType: string, size: number): SourceItem {
  const extension = mimeType.split('/')[1].replace(/^jpeg$/, 'jpg').replace(/^(?:x-icon|vnd\.microsoft\.icon)$/, 'ico')
  const name = alt.trim().slice(0, 100) || `图片.${extension}`
  return {
    id: crypto.randomUUID(), nodeId, name, mimeType, size, dataUrl,
    textContent: '', kind: 'image', usage: 'detail-image', createdAt: Date.now(),
  }
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function saveDetailImages(nodeId: string, files: File[]) {
  const images = files.filter(isDetailImageFile)
  const sources = await Promise.all(images.map(async (file) =>
    imageSource(nodeId, file.name, await readFile(file), file.type, file.size),
  ))
  if (sources.length) {
    await db.transaction('rw', [db.nodes, db.sources], async () => {
      if (!(await db.nodes.get(nodeId))) throw new Error('节点已不存在')
      await db.sources.bulkAdd(sources)
    })
  }
  return sources
}

/** Move legacy inline Markdown images to sources and update the note together. */
export async function migrateEmbeddedDetailImages(nodeId: string, markdown: string) {
  if (!markdown.includes(';base64,')) return
  let fence: string | undefined
  const images = new Map<string, SourceItem>()
  const next = markdown.split('\n').map((line) => {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined
      return line
    }
    if (marker) {
      fence = marker[1]
      return line
    }
    // Indented Markdown code and inline code keep their original text.
    if (/^(?: {4}|\t)/.test(line)) return line
    return line.replace(markdownImage, (match, _code, prefix, alt, url) => {
      if (!url) return match
      const parsed = dataImage.exec(url)
      if (!parsed) return match
      let source = images.get(url)
      if (!source) {
        const [, mime, base64] = parsed
        const size = Math.floor(base64.replace(/=+$/, '').length * 3 / 4)
        if (!size) return match
        source = imageSource(nodeId, alt, url, mime, size)
        images.set(url, source)
      }
      return prefix + detailImageRef(source.id)
    })
  }).join('\n')
  if (!images.size) return

  await db.transaction('rw', [db.details, db.sources], async () => {
    const current = await db.details.get(nodeId)
    if (current?.markdown !== markdown) return
    await db.sources.bulkAdd([...images.values()])
    await db.details.put({ ...current, markdown: next })
  })
}

/** Load a local image via srcset; src remains the stable Markdown reference. */
export function mountDetailImages(root: HTMLElement) {
  const pending = new Map<string, Promise<string | undefined>>()
  const urls = new Set<string>()
  let disposed = false

  const load = async (id: string) => {
    const source = await db.sources.get(id)
    if (source?.kind !== 'image' || !source.dataUrl || !dataImage.test(source.dataUrl)) return
    const blob = await (await fetch(source.dataUrl)).blob()
    if (disposed) return
    const url = URL.createObjectURL(blob)
    urls.add(url)
    return url
  }

  const hydrate = () => {
    for (const image of root.querySelectorAll<HTMLImageElement>('img[src^="#kb-image-"]')) {
      const src = image.getAttribute('src')
      const id = reference.exec(src || '')?.[1]
      if (!id || image.srcset) continue
      let job = pending.get(id)
      if (!job) {
        job = load(id).catch(() => undefined)
        pending.set(id, job)
        // A restored backup can make a previously missing reference available.
        void job.then((url) => { if (!url) pending.delete(id) })
      }
      void job.then((url) => {
        if (url && !disposed && root.contains(image) && image.getAttribute('src') === src) {
          image.srcset = url
        }
      })
    }
  }
  const observer = new MutationObserver(hydrate)
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] })
  hydrate()
  return () => {
    disposed = true
    observer.disconnect()
    urls.forEach((url) => URL.revokeObjectURL(url))
  }
}
