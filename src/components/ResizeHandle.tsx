import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const MIN = 200
const MAX = 560
const STORAGE_KEY = 'knowledge-box-sidebar-width'

export function readSidebarWidth(fallback = 280) {
  const raw = localStorage.getItem(STORAGE_KEY)
  const n = raw ? Number(raw) : fallback
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX, Math.max(MIN, n))
}

interface Props {
  width: number
  onChange: (width: number) => void
  disabled?: boolean
}

export function ResizeHandle({ width, onChange, disabled }: Props) {
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const startWidth = useRef(width)

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return
      e.preventDefault()
      startX.current = e.clientX
      startWidth.current = width
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [width, disabled],
  )

  useEffect(() => {
    if (!dragging) return
    document.body.classList.add('resizing')

    const onMove = (e: PointerEvent) => {
      const next = startWidth.current + (e.clientX - startX.current)
      onChange(Math.min(MAX, Math.max(MIN, next)))
    }
    const onUp = () => setDragging(false)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      document.body.classList.remove('resizing')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, onChange])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width))
  }, [width])

  return (
    <div
      className={`resize-handle ${dragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onPointerDown={onPointerDown}
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={Math.round(width)}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      title={disabled ? '展开左侧栏后可拖动' : '拖动调整左右宽度'}
    />
  )
}
