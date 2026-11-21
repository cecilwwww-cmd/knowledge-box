import type { DetailMode } from './types'
import { ChevronIcon, EditIcon, ReadIcon } from './DetailIcons'

type Props = {
  mode: DetailMode
  isFullscreen: boolean
  onToggleMode: () => void
  onExitFullscreen: () => void
}

/** 顶栏感应箭头 + 阅读/编辑切换 + 全屏退出 */
export function DetailChrome({
  mode,
  isFullscreen,
  onToggleMode,
  onExitFullscreen,
}: Props) {
  const modeTip =
    mode === 'read'
      ? '当前：阅读（点击切换到编辑）'
      : '当前：编辑（点击切换到阅读）'

  return (
    <>
      {!isFullscreen && (
        <button
          type="button"
          className="detail-chrome-chevron"
          title="展开工具栏"
          aria-label="展开工具栏"
          onClick={(event) => event.currentTarget.focus()}
        >
          <ChevronIcon />
        </button>
      )}
      {isFullscreen && (
        <button
          type="button"
          className="detail-fs-exit"
          title="退出全屏（Esc）"
          onClick={onExitFullscreen}
        >
          退出全屏
        </button>
      )}
      <button
        type="button"
        className="detail-mode-toggle"
        title={modeTip}
        aria-label={modeTip}
        onClick={onToggleMode}
      >
        {mode === 'read' ? <ReadIcon /> : <EditIcon />}
      </button>
    </>
  )
}
