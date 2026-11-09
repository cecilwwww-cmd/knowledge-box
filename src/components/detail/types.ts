import type { DetailTemplateId } from '../../db/types'

export type DetailMode = 'read' | 'edit'

export type DetailEditorProps = {
  markdown: string
  onChange: (markdown: string) => void
  template?: DetailTemplateId | string
}

export const DETAIL_TPL_IDS: DetailTemplateId[] = [
  'default',
  'textbook',
  'paper',
  'cartoon',
]
