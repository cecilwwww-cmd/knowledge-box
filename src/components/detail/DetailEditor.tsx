import { useState } from 'react'
import { createPortal } from 'react-dom'
import 'vditor/dist/index.css'
import { resolveDetailTemplate } from '../../lib/detailTemplates'
import { DetailChrome } from './DetailChrome'
import type { DetailEditorProps, DetailMode } from './types'
import { useDetailVditor } from './useDetailVditor'

export type { DetailEditorProps, DetailMode } from './types'

export function DetailEditor({
  nodeId,
  markdown,
  headingTarget,
  onChange,
  template,
}: DetailEditorProps) {
  const tpl = resolveDetailTemplate(template)
  const [mode, setMode] = useState<DetailMode>(() => tpl === 'default' ? 'read' : 'edit')
  const { hostRef, toolbarControls, isFullscreen, exitFullscreen } =
    useDetailVditor({
      nodeId,
      markdown,
      headingTarget,
      onChange,
      template: tpl,
      mode,
    })

  return (
    <div className={`detail-editor detail-tpl-${tpl} is-${mode}`}>
      <div className="vditor-host" ref={hostRef} />
      {toolbarControls &&
        createPortal(
          <DetailChrome
            mode={mode}
            isFullscreen={isFullscreen}
            onToggleMode={() => setMode((m) => (m === 'read' ? 'edit' : 'read'))}
            onExitFullscreen={exitFullscreen}
          />,
          toolbarControls,
        )}
    </div>
  )
}
