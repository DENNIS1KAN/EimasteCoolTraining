import { useSyncExternalStore } from 'react'

/**
 * "Add to Home Screen" support.
 * - Chrome/Edge/Android fire `beforeinstallprompt`; we keep the event so a button can open the native prompt.
 * - iOS never does: people use Share → Add to Home Screen, so we show instructions for their platform.
 * The listener registers when this module is first imported (import it early to catch the event).
 */
export type InstallPlatform = 'ios' | 'android' | 'desktop'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Which instructions fit this device. iPadOS pretends to be a Mac, but it has a touch screen. */
export function detectPlatform(ua: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/** On iOS only Safari could add web apps before iOS 16.4; other browsers still hide it well. */
export const isIosOtherBrowser = (ua: string): boolean => /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua)

export function currentPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'desktop'
  return detectPlatform(navigator.userAgent, navigator.maxTouchPoints || 0)
}

/** True when the app runs from the Home Screen / as an installed app. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return !!(window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone)
}

interface InstallState {
  canPrompt: boolean
  installed: boolean
}

let deferred: BeforeInstallPromptEvent | null = null
let state: InstallState = { canPrompt: false, installed: isStandalone() }
const listeners = new Set<() => void>()
const set = (p: Partial<InstallState>) => {
  state = { ...state, ...p }
  listeners.forEach((f) => f())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    set({ canPrompt: true })
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    set({ canPrompt: false, installed: true })
  })
}

/** Open the browser's install prompt (when it offered one). */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const ev = deferred
  if (!ev) return 'unavailable'
  deferred = null
  set({ canPrompt: false })
  try {
    await ev.prompt()
    const { outcome } = await ev.userChoice
    if (outcome === 'accepted') set({ installed: true })
    return outcome
  } catch {
    return 'unavailable'
  }
}

const getState = () => state
export function useInstall(): InstallState {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    getState,
    getState,
  )
}
