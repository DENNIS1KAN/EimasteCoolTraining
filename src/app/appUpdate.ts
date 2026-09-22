import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Keeping an open app consistent with a new deploy.
 *
 * The service worker is generated with `registerType: 'autoUpdate'` (skipWaiting + clientsClaim): a new version
 * installs in the background, takes over the open page and deletes the old precached files. The page is still
 * running the old code, so its next lazy page chunk (hashed file names) would 404. Two guards:
 *  - watchServiceWorkerUpdates(): when a new worker takes control, reload right away if the app was only just
 *    opened (the usual case: the update check runs at launch) or is in the background; otherwise reload the
 *    next time the app goes to the background, so nobody loses what they are typing.
 *  - lazyPage(): a page chunk that fails to load reloads the app once (instead of crashing to a blank screen).
 * Writes are persisted immediately (store outbox), so a reload never loses logged data.
 */

const RELOAD_KEY = 'ect-reloaded-at'
/** Treat a controller change this soon after launch as "the update found at launch": reload immediately. */
const FRESH_MS = 15_000
/** Never reload twice within this window (a broken deploy must not loop). */
const RELOAD_GUARD_MS = 20_000

function lastReload(): number {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY)) || 0
  } catch {
    return 0
  }
}

/** Reload the page unless we already did so moments ago. Returns false when the guard stopped it. */
export function reloadOnce(): boolean {
  const now = Date.now()
  if (now - lastReload() < RELOAD_GUARD_MS) return false
  try {
    sessionStorage.setItem(RELOAD_KEY, String(now))
  } catch {
    /* private mode: the guard is best effort */
  }
  location.reload()
  return true
}

export function watchServiceWorkerUpdates(): void {
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined
  if (!sw) return
  const startedAt = Date.now()
  // No controller at launch = first install: that worker taking over changes nothing for the running page.
  let hadController = !!sw.controller
  sw.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true
      return
    }
    if (document.visibilityState === 'hidden' || Date.now() - startedAt < FRESH_MS) {
      reloadOnce()
      return
    }
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return
      document.removeEventListener('visibilitychange', onHide)
      reloadOnce()
    }
    document.addEventListener('visibilitychange', onHide)
  })
}

/** Heuristic for "the code for this page could not be fetched" across browsers. */
export function isChunkLoadError(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e)
  return /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError|Failed to fetch/i.test(msg)
}

/** React.lazy for route pages: a stale or missing chunk reloads the app once, then surfaces the error. */
export function lazyPage<T extends ComponentType<object>>(load: () => Promise<{ default: T }>): LazyExoticComponent<T> {
  return lazy(() =>
    load().catch((e: unknown) => {
      if (isChunkLoadError(e) && typeof navigator !== 'undefined' && navigator.onLine !== false && reloadOnce()) {
        // The page is going away; keep Suspense showing its fallback until it does.
        return new Promise<{ default: T }>(() => {})
      }
      throw e
    }),
  )
}
