import type { SourceItem } from '../db/types'

export function sourceKind(source: SourceItem) {
  const type = source.mimeType || ''
  if (/\.pdf$/i.test(source.name) || type === 'application/pdf') return 'pdf'
  if (/\.docx?$/i.test(source.name) || type === 'application/msword' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'word'
  if (source.kind) return source.kind
  if (type.startsWith('image/') || source.dataUrl?.startsWith('data:image/')) return 'image'
  return 'text'
}

export function sourceFile(source: SourceItem) {
  return source.dataUrl?.startsWith('data:') ? source.dataUrl : undefined
}

export const embeddedImage = /^data:image\/(png|jpeg|jpg|gif|webp|bmp|x-ms-bmp);base64,/i
