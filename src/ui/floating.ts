import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Stacking for bars that float above the tab bar (Body quick-log dock, rest timer, …) so they never cover each other.
 * Each bar registers with a priority: lower priorities sit closer to the tab bar. A bar is positioned with
 *   bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 8px + <offset>px)
 * where <offset> is what useFloatingBar returns (the heights of the lower bars + gaps).
 * The total height of all bars is published as --float-stack on <html>, so toasts can sit above them.
 */
export const FLOAT_PRIORITY = { dock: 0, timer: 10 } as const
const GAP = 8

type Entry = { priority: number; height: number }
const bars = new Map<symbol, Entry>()
const listeners = new Set<() => void>()

function publish() {
  const total = [...bars.values()].reduce((a, b) => a + b.height + GAP, 0)
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--float-stack', `${total}px`)
  listeners.forEach((f) => f())
}

function offsetOf(id: symbol): number {
  const me = bars.get(id)
  if (!me) return 0
  let off = 0
  for (const [k, e] of bars) if (k !== id && (e.priority < me.priority || (e.priority === me.priority && k.toString() < id.toString()))) off += e.height + GAP
  return off
}

/**
 * Register a floating bar while `active`; returns its bottom offset in px (0 when it is the lowest bar).
 * Pass a ref to the bar's outer element: its height is measured with a ResizeObserver.
 */
export function useFloatingBar(ref: RefObject<HTMLElement | null>, priority: number, active = true): number {
  const [id] = useState(() => Symbol('float'))
  const [offset, setOffset] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!active || !el) return
    const update = () => setOffset(offsetOf(id))
    listeners.add(update)
    bars.set(id, { priority, height: el.getBoundingClientRect().height })
    publish()
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          const h = el.getBoundingClientRect().height
          const cur = bars.get(id)
          if (cur && Math.abs(cur.height - h) > 0.5) {
            bars.set(id, { priority, height: h })
            publish()
          }
        })
      : null
    ro?.observe(el)
    return () => {
      ro?.disconnect()
      listeners.delete(update)
      bars.delete(id)
      publish()
    }
  }, [ref, priority, active, id])
  return offset
}
