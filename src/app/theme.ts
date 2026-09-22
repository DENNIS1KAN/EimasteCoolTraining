import { useSyncExternalStore } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'ect-theme'
const listeners = new Set<() => void>()

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

let pref: ThemePref = read()

/** Apply the preference to <html data-theme>. "system" removes the attribute so prefers-color-scheme decides. */
export function applyTheme(p: ThemePref = pref): void {
  const root = document.documentElement
  if (p === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', p)
  const dark = p === 'dark' || (p === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0b0d10' : '#f4f5f2')
}

export function setThemePref(p: ThemePref): void {
  pref = p
  try {
    localStorage.setItem(KEY, p)
  } catch {
    /* ignore */
  }
  applyTheme(p)
  listeners.forEach((f) => f())
}

export const getThemePref = (): ThemePref => pref
export const useThemePref = (): ThemePref =>
  useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    getThemePref,
    getThemePref,
  )

/** Whether dark colors are showing right now (for canvas-like drawing that can't use CSS variables). */
export function isDarkNow(): boolean {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr) return attr === 'dark'
  return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
}
