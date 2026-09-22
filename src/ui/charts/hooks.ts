import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'

/** Width used where the container can't be measured (jsdom tests, very old browsers). */
export const FALLBACK_WIDTH = 320

const canObserve = () => typeof ResizeObserver !== 'undefined'

/**
 * Track an element's content width. Returns null until the first measurement, so charts render nothing
 * rather than a wrong-sized frame; without ResizeObserver it falls back to FALLBACK_WIDTH at once.
 */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number | null] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState<number | null>(() => (canObserve() ? null : FALLBACK_WIDTH))
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !canObserve()) return
    const set = (w: number) => {
      if (w > 0) setWidth(Math.floor(w))
    }
    set(el.getBoundingClientRect().width)
    const ro = new ResizeObserver((entries) => set(entries[0]?.contentRect.width ?? 0))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

export interface ScrubOptions {
  /** Number of selectable positions (points, categories or cells). */
  count: number
  /** Pointer position (px relative to the interactive element) to a position index, or null for none. */
  hitTest: (x: number, y: number) => number | null
  /** Custom arrow-key movement (2D grids). Return null to leave the key unhandled. */
  move?: (key: string, current: number) => number | null
  /** Index selected when the element receives keyboard focus. Defaults to the last one (the latest data). */
  initial?: number
}

export interface Scrub {
  active: number | null
  setActive: (i: number | null) => void
  bind: {
    ref: RefObject<HTMLDivElement | null>
    tabIndex: number
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => void
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => void
    onPointerLeave: (e: PointerEvent<HTMLDivElement>) => void
    onPointerUp: () => void
    onPointerCancel: () => void
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
    onFocus: () => void
    onBlur: () => void
  }
}

const defaultMove = (key: string, i: number, count: number): number | null => {
  if (key === 'ArrowRight') return Math.min(count - 1, i + 1)
  if (key === 'ArrowLeft') return Math.max(0, i - 1)
  return null
}

/**
 * Shared hover / touch-scrub / keyboard behaviour for charts.
 * - mouse: follows the pointer, clears on leave.
 * - touch & pen: tap or drag to scrub; the reading stays until the next tap elsewhere.
 * - keyboard: focus selects the latest point, arrows move, Home/End jump, Escape clears.
 */
export function useScrub({ count, hitTest, move, initial }: ScrubOptions): Scrub {
  const ref = useRef<HTMLDivElement | null>(null)
  const [active, setActiveState] = useState<number | null>(null)
  const pressed = useRef(false)
  const setActive = useCallback((i: number | null) => setActiveState(i), [])

  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return hitTest(e.clientX - r.left, e.clientY - r.top)
  }

  // A tap outside dismisses a touch reading (blur alone misses taps on non-focusable content in iOS Safari).
  const isActive = active != null
  useEffect(() => {
    if (!isActive) return
    const onDown = (e: Event) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setActiveState(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [isActive])

  // Keep the index valid when the data shrinks.
  useEffect(() => {
    if (active != null && active >= count) setActiveState(count ? count - 1 : null)
  }, [active, count])

  return {
    active,
    setActive,
    bind: {
      ref,
      tabIndex: count ? 0 : -1,
      onPointerDown: (e) => {
        pressed.current = true
        if (e.pointerType !== 'mouse') setActiveState(at(e))
      },
      onPointerMove: (e) => {
        if (e.pointerType === 'mouse' || pressed.current) setActiveState(at(e))
      },
      onPointerLeave: (e) => {
        pressed.current = false
        if (e.pointerType === 'mouse') setActiveState(null)
      },
      onPointerUp: () => {
        pressed.current = false
      },
      onPointerCancel: () => {
        pressed.current = false
      },
      onKeyDown: (e) => {
        if (!count) return
        const cur = active ?? initial ?? count - 1
        let next: number | null = null
        if (e.key === 'Home') next = 0
        else if (e.key === 'End') next = count - 1
        else if (e.key === 'Escape') {
          if (active == null) return
          setActiveState(null)
          e.preventDefault()
          return
        } else next = move ? move(e.key, cur) : defaultMove(e.key, cur, count)
        if (next == null) return
        e.preventDefault()
        setActiveState(active == null && e.key.startsWith('Arrow') ? cur : next)
      },
      onFocus: () => setActiveState((a) => a ?? (count ? (initial ?? count - 1) : null)),
      onBlur: () => {
        pressed.current = false
        setActiveState(null)
      },
    },
  }
}
