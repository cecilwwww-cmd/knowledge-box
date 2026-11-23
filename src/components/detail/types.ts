import type { GraphHeading } from '../../../prototypes/knowledge-graph/model.js'
import type { DetailTemplateId } from '../../db/types'

export type DetailMode = 'read' | 'edit'

export type DetailEditorProps = {
  nodeId: string
  markdown: string
  headingTarget?: GraphHeading
  onChange: (markdown: string) => void
  template?: DetailTemplateId | string
}

export const DETAIL_TPL_IDS: DetailTemplateId[] = [
  'default',
  'textbook',
  'paper',
  'cartoon',
]
