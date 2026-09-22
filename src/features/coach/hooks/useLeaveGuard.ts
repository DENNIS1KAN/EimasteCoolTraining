import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

export interface LeaveGuard {
  /** Where the viewer tried to go while there were unsaved changes (null: nothing pending). */
  pending: string | null
  /** Drop the changes and go there. */
  leave: () => void
  /** Stay on the page. */
  stay: () => void
}

/** The in-app route an anchor points at ("#/coach?tab=programs" -> "/coach?tab=programs"), or null. */
export function appRouteOf(a: Element | null | undefined): string | null {
  if (!a || a.tagName !== 'A') return null
  const anchor = a as HTMLAnchorElement
  if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return null
  const href = anchor.getAttribute('href') ?? ''
  return href.startsWith('#/') ? href.slice(1) : null
}

/**
 * Hold navigation away from a page with unsaved changes. While `dirty`, a click on any in-app link on the
 * page (the header's back arrow, the tab bar or sidebar, a link in the content) is caught before the router
 * sees it and becomes `pending`, so the page can ask first; closing or reloading the tab gets the browser's
 * own prompt. Clicks that open a new tab are left alone.
 */
export function useLeaveGuard(dirty: boolean): LeaveGuard {
  const navigate = useNavigate()
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    if (!dirty) return
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const to = appRouteOf((e.target as Element | null)?.closest?.('a[href]'))
      if (to == null || `#${to}` === window.location.hash) return
      e.preventDefault()
      e.stopPropagation()
      setPending(to)
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    // capture on the document runs before React's handlers on the root, so the router never navigates
    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [dirty])

  return {
    pending,
    leave: () => {
      const to = pending
      setPending(null)
      if (to != null) navigate(to)
    },
    stay: () => setPending(null),
  }
}
