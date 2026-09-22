import { useEffect, useState, useSyncExternalStore } from 'react'
import type { WorkoutLog } from '../../data/types'
import { useStore } from '../../data/store'

/** Current time, refreshed every `ms` while `active` (for clocks). */
export function useNow(ms: number, active = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms, active])
  return now
}

/**
 * A member's logs, optionally without one log (the one being edited). The array keeps its identity while that
 * excluded log changes (the store compares selector results shallowly), so memoized stats don't recompute on
 * every keystroke.
 */
export function useMemberLogs(memberId: string | null | undefined, excludeId?: string): WorkoutLog[] {
  return useStore((s) => {
    const out: WorkoutLog[] = []
    if (!memberId) return out
    for (const l of Object.values(s.logs)) if (l.memberId === memberId && l.id !== excludeId) out.push(l)
    return out
  })
}

/* ------------------------------------------------------------------ single rest-timer host */

/**
 * Several places may mount the rest timer (the Train page, and the app shell if it opts in); only one renders.
 * A "global" host (the shell) wins over page-level ones.
 */
const hosts: { id: number; global: boolean }[] = []
const hostListeners = new Set<() => void>()
let hostSeq = 0
let activeHost = 0
function recompute() {
  const next = (hosts.find((h) => h.global) ?? hosts[0])?.id ?? 0
  if (next !== activeHost) {
    activeHost = next
    hostListeners.forEach((f) => f())
  }
}

export function useIsActiveHost(global: boolean): boolean {
  const [id] = useState(() => ++hostSeq)
  useEffect(() => {
    hosts.push({ id, global })
    recompute()
    return () => {
      const i = hosts.findIndex((h) => h.id === id)
      if (i >= 0) hosts.splice(i, 1)
      recompute()
    }
  }, [id, global])
  const active = useSyncExternalStore(
    (f) => {
      hostListeners.add(f)
      return () => hostListeners.delete(f)
    },
    () => activeHost,
    () => activeHost,
  )
  return active === id
}
