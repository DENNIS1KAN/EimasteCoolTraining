/**
 * Tiny message layer: every feature defines its own table with defineMessages() next to its code,
 * so features never edit a shared dictionary. Interpolation uses {name} placeholders.
 *
 *   const M = defineMessages({ hello: 'Hi {name}' })
 *   const t = useT(M); t('hello', { name })
 *
 * The app ships in English only. The indirection is kept so copy stays out of the components
 * and another language can be added back by giving the tables a second entry.
 */
export type Vars = Record<string, string | number>
export interface Messages<K extends string> {
  en: Record<K, string>
}

/** BCP-47 locale for Intl formatting. */
export const LOCALE = 'en-GB'

export function defineMessages<K extends string>(en: Record<K, string>): Messages<K> {
  return { en }
}

export function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

export function translate<K extends string>(m: Messages<K>, k: K, vars?: Vars): string {
  return interpolate(m.en[k] ?? k, vars)
}

/** Hook returning t(key, vars). */
export function useT<K extends string>(m: Messages<K>): (k: K, vars?: Vars) => string {
  return (k: K, vars?: Vars) => translate(m, k, vars)
}

/** Pick the "one" or "other" form: plural(n, t('workout'), t('workouts')). */
export const plural = (n: number, one: string, other: string): string => (Math.abs(n) === 1 ? one : other)
