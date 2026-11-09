import { useCallback, useEffect, useRef, useState } from 'react'

/** 顶部感应条 / 工具栏悬停展开 */
export function useHoverToolbar(delayMs = 180) {
  const [hover, setHover] = useState(false)
  const leaveTimer = useRef<number | null>(null)

  const open = useCallback(() => {
    if (leaveTimer.current) {
      window.clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
    setHover(true)
  }, [])

  const scheduleClose = useCallback(() => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => {
      setHover(false)
      leaveTimer.current = null
    }, delayMs)
  }, [delayMs])

  useEffect(
    () => () => {
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    },
    [],
  )

  return {
    visible: hover,
    open,
    scheduleClose,
    setHover,
  }
}
