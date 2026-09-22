import { useSyncExternalStore } from 'react'

/**
 * Tiny i18n: every feature defines its own message table with defineMessages(en, el) next to its code,
 * so features never edit a shared dictionary. Interpolation uses {name} placeholders.
 *
 *   const M = defineMessages({ hello: 'Hi {name}' }, { hello: 'Γεια σου {name}' })
 *   const t = useT(M); t('hello', { name })
 */
export type Lang = 'en' | 'el'
export const LANGS: Lang[] = ['en', 'el']
export type Vars = Record<string, string | number>
export interface Messages<K extends string> {
  en: Record<K, string>
  el: Record<K, string>
}

const KEY = 'ect-lang'
const listeners = new Set<() => void>()

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'el') return saved
  } catch {
    /* storage unavailable */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : ''
  return nav.toLowerCase().startsWith('el') ? 'el' : 'en'
}

let current: Lang = detect()

export const getLang = (): Lang => current
export function setLang(l: Lang): void {
  if (l === current) return
  current = l
  try {
    localStorage.setItem(KEY, l)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = l
  listeners.forEach((f) => f())
}
const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => listeners.delete(f)
}
export const useLang = (): Lang => useSyncExternalStore(subscribe, getLang, getLang)

/** BCP-47 locale for Intl formatting. */
export const localeOf = (l: Lang = current): string => (l === 'el' ? 'el-GR' : 'en-GB')

export function defineMessages<K extends string>(en: Record<K, string>, el: Record<K, string>): Messages<K> {
  return { en, el }
}

export function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

export function translate<K extends string>(m: Messages<K>, k: K, vars?: Vars, l: Lang = current): string {
  const s = m[l][k] ?? m.en[k] ?? k
  return interpolate(s, vars)
}

/** Hook returning t(key, vars) bound to the current language (re-renders on language change). */
export function useT<K extends string>(m: Messages<K>): (k: K, vars?: Vars) => string {
  const l = useLang()
  return (k: K, vars?: Vars) => translate(m, k, vars, l)
}

/** Pick the "one" or "other" form: plural(n, t('workout'), t('workouts')). Greek and English share this rule. */
export const plural = (n: number, one: string, other: string): string => (Math.abs(n) === 1 ? one : other)
