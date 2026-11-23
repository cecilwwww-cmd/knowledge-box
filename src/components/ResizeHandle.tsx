import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const MIN = 200
const ASSISTANT_MIN = 166
const MAX = 560
const STORAGE_KEY = 'knowledge-box-sidebar-width'

export function readSidebarWidth(fallback = 280, side: 'left' | 'right' = 'left') {
  const raw = localStorage.getItem(side === 'right' ? 'knowledge-box-assistant-width' : STORAGE_KEY)
  const n = raw ? Number(raw) : fallback
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX, Math.max(side === 'right' ? ASSISTANT_MIN : MIN, n))
}

interface Props {
  width: number
  onChange: (width: number) => void
  disabled?: boolean
  side?: 'left' | 'right'
}

export function ResizeHandle({ width, onChange, disabled, side = 'left' }: Props) {
  const minWidth = side === 'right' ? ASSISTANT_MIN : MIN
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const startWidth = useRef(width)

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return
      e.preventDefault()
      startX.current = e.clientX
      startWidth.current = side === 'right'
        ? e.currentTarget.nextElementSibling?.getBoundingClientRect().width ?? width
        : width
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [width, disabled, side],
  )

  useEffect(() => {
    if (!dragging) return
    document.body.classList.add('resizing')

    const onMove = (e: PointerEvent) => {
      const next = startWidth.current + (e.clientX - startX.current) * (side === 'right' ? -1 : 1)
      onChange(Math.min(MAX, Math.max(minWidth, next)))
    }
    const onUp = () => setDragging(false)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      document.body.classList.remove('resizing')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, onChange, side, minWidth])

  useEffect(() => {
    localStorage.setItem(side === 'right' ? 'knowledge-box-assistant-width' : STORAGE_KEY, String(width))
  }, [width, side])

  return (
    <div
      className={`resize-handle ${side === 'right' ? 'assistant-resize' : ''} ${dragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onPointerDown={onPointerDown}
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={Math.round(width)}
      aria-valuemin={minWidth}
      aria-valuemax={MAX}
      aria-label={side === 'right' ? '调整 AI 助手宽度' : '调整知识库宽度'}
      title={disabled ? '展开左侧栏后可拖动' : '拖动调整左右宽度'}
    />
  )
}
