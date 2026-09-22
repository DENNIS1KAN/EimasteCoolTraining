import { useCallback, useEffect, useSyncExternalStore } from 'react'

/** Live `matchMedia` result, e.g. useMediaQuery('(min-width: 1024px)'). False when unsupported. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = typeof window !== 'undefined' ? window.matchMedia?.(query) : undefined
      if (!mql) return () => {}
      if (mql.addEventListener) mql.addEventListener('change', cb)
      else mql.addListener?.(cb)
      return () => {
        if (mql.removeEventListener) mql.removeEventListener('change', cb)
        else mql.removeListener?.(cb)
      }
    },
    [query],
  )
  const get = () => (typeof window !== 'undefined' ? !!window.matchMedia?.(query)?.matches : false)
  return useSyncExternalStore(subscribe, get, () => false)
}

/** prefers-reduced-motion: reduce */
export const useReducedMotion = (): boolean => useMediaQuery('(prefers-reduced-motion: reduce)')

/** Desktop layout (the tab bar becomes a sidebar). */
export const useIsDesktop = (): boolean => useMediaQuery('(min-width: 1024px)')

/**
 * Keeps the screen on while `active` (a workout in progress) using the Screen Wake Lock API.
 * Re-acquires the lock when the page becomes visible again. Silently a no-op when unsupported or refused.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || typeof document === 'undefined') return
    const wl = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock
    if (!wl || typeof wl.request !== 'function') return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      if (sentinel && !sentinel.released) return
      try {
        const s = await wl.request('screen')
        if (cancelled) void s.release().catch(() => {})
        else sentinel = s
      } catch {
        /* denied (battery saver, not visible…): ignore */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {})
      sentinel = null
    }
  }, [active])
}
