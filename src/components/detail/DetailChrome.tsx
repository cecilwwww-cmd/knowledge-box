import type { DetailMode } from './types'
import { ChevronIcon, EditIcon, ReadIcon } from './DetailIcons'

type Props = {
  mode: DetailMode
  toolbarVisible: boolean
  isFullscreen: boolean
  onOpenToolbar: () => void
  onScheduleCloseToolbar: () => void
  onToggleMode: () => void
  onExitFullscreen: () => void
}

/** 顶栏感应箭头 + 阅读/编辑切换 + 全屏退出 */
export function DetailChrome({
  mode,
  toolbarVisible,
  isFullscreen,
  onOpenToolbar,
  onScheduleCloseToolbar,
  onToggleMode,
  onExitFullscreen,
}: Props) {
  const modeTip =
    mode === 'read'
      ? '当前：阅读（点击切换到编辑）'
      : '当前：编辑（点击切换到阅读）'

  return (
    <>
      <div
        className={`detail-toolbar-rail ${isFullscreen ? 'is-fs' : ''} ${
          toolbarVisible ? 'is-open' : ''
        }`}
        onMouseEnter={onOpenToolbar}
        onMouseLeave={onScheduleCloseToolbar}
      >
        <button
          type="button"
          className={`detail-chrome-chevron ${
            toolbarVisible ? 'is-hidden' : ''
          }`}
          title="展开工具栏"
          aria-label="展开工具栏"
          aria-expanded={toolbarVisible}
          tabIndex={toolbarVisible ? -1 : 0}
          onClick={onOpenToolbar}
        >
          <ChevronIcon />
        </button>
        {isFullscreen ? (
          <button
            type="button"
            className={`detail-fs-exit ${toolbarVisible ? 'is-shown' : ''}`}
            title="退出全屏（Esc）"
            onClick={onExitFullscreen}
          >
            退出全屏
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className={`detail-mode-toggle ${toolbarVisible ? 'is-shown' : ''}`}
        title={modeTip}
        aria-label={modeTip}
        onMouseEnter={onOpenToolbar}
        onClick={onToggleMode}
      >
        {mode === 'read' ? <ReadIcon /> : <EditIcon />}
      </button>
    </>
  )
}
