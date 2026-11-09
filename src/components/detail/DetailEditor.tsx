import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import 'vditor/dist/index.css'
import { resolveDetailTemplate } from '../../lib/detailTemplates'
import { DetailChrome } from './DetailChrome'
import type { DetailEditorProps, DetailMode } from './types'
import { useDetailVditor } from './useDetailVditor'
import { useHoverToolbar } from './useHoverToolbar'

export type { DetailEditorProps, DetailMode } from './types'

export function DetailEditor({
  markdown,
  onChange,
  template,
}: DetailEditorProps) {
  const tpl = resolveDetailTemplate(template)
  const [mode, setMode] = useState<DetailMode>('edit')
  const toolbar = useHoverToolbar()

  const { hostRef, vditorElRef, isFullscreen, exitFullscreen } =
    useDetailVditor({
      markdown,
      onChange,
      template: tpl,
      mode,
      toolbarVisible: toolbar.visible,
      onToolbarEnter: toolbar.open,
      onToolbarLeave: toolbar.scheduleClose,
    })

  // 进入全屏时收起感应条，恢复悬停下拉手感
  useEffect(() => {
    if (isFullscreen) toolbar.setHover(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen])

  const chrome = (
    <DetailChrome
      mode={mode}
      toolbarVisible={toolbar.visible}
      isFullscreen={isFullscreen}
      onOpenToolbar={toolbar.open}
      onScheduleCloseToolbar={toolbar.scheduleClose}
      onToggleMode={() => setMode((m) => (m === 'read' ? 'edit' : 'read'))}
      onExitFullscreen={exitFullscreen}
    />
  )

  const chromeMount =
    isFullscreen && vditorElRef.current ? vditorElRef.current : null

  return (
    <div
      className={`detail-editor detail-tpl-${tpl} is-${mode} ${
        toolbar.visible ? 'toolbar-visible' : ''
      } ${isFullscreen ? 'is-fullscreen' : ''}`}
    >
      {chromeMount ? createPortal(chrome, chromeMount) : chrome}
      <div className="vditor-host" ref={hostRef} />
    </div>
  )
}
