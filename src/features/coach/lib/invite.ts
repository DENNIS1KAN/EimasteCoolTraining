/** Invite links: the coach shares one per member; opening it lands on the join screen with the code filled in. */

export interface AppLocation {
  origin: string
  pathname: string
}

/** location.origin + location.pathname + '#/join/' + slug + '?code=' + code */
export function inviteLink(loc: AppLocation, slug: string, code: string): string {
  return `${loc.origin}${loc.pathname}#/join/${encodeURIComponent(slug)}?code=${encodeURIComponent(code)}`
}

/** The current page's app location (window.location in the browser). */
export const appLocation = (): AppLocation =>
  typeof window === 'undefined' ? { origin: '', pathname: '/' } : { origin: window.location.origin, pathname: window.location.pathname }

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

/** Copy text to the clipboard, with a textarea fallback for older browsers / insecure origins. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

/**
 * Share through the Web Share API (WhatsApp, Messages, …); falls back to copying the whole message.
 * The link is appended to the text rather than passed as `url`, so apps that drop one of the fields still get it.
 */
export async function shareOrCopy(input: { title: string; text: string }): Promise<ShareOutcome> {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title: input.title, text: input.text })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      /* NotAllowedError etc.: copy instead */
    }
  }
  return (await copyText(input.text)) ? 'copied' : 'failed'
}
