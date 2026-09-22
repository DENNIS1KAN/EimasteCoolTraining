/** The profile last picked on the login screen of this device, so the next visit starts on it. */
const KEY = 'ect-last-profile'

export function getLastProfile(): string | null {
  try {
    return localStorage.getItem(KEY) || null
  } catch {
    return null
  }
}

export function setLastProfile(slug: string | null): void {
  try {
    if (slug) localStorage.setItem(KEY, slug)
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode: only a convenience */
  }
}
