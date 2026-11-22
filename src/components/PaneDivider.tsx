export function PaneDivider({ label, value, onChange }: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  const resize = (next: number) => onChange(Math.min(76, Math.max(24, next)))
  return (
    <div className="mind-divider" role="separator" aria-label={label} aria-orientation="vertical"
      aria-valuemin={24} aria-valuemax={76} aria-valuenow={Math.round(value)} tabIndex={0}
      onDoubleClick={() => resize(50)}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.focus()
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        const frame = event.currentTarget.parentElement?.getBoundingClientRect()
        const width = event.currentTarget.getBoundingClientRect().width
        if (frame && frame.width > width) {
          resize((event.clientX - frame.left - width / 2) / (frame.width - width) * 100)
        }
      }}
      onKeyDown={(event) => {
        const offsets = { ArrowLeft: value - 4, ArrowRight: value + 4, Home: 24, End: 76 }
        const next = offsets[event.key as keyof typeof offsets]
        if (typeof next !== 'number') return
        event.preventDefault()
        resize(next)
      }}
      title="拖动调整宽度，双击恢复等宽" />
  )
}
