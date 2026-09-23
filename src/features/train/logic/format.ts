/** Short prescription text for the spec strip and captions. Program content stays as written (English). */
import { parseNum } from '../../../lib/units'
import { fmtNum } from '../../../lib/format'
import { LOCALE } from '../../../i18n'

/** "8-10" -> "8–10" (en dash between numbers). */
export const fmtRange = (s: string): string => s.trim().replace(/(\d)\s*-\s*(\d)/g, '$1–$2')

/** "~8-9" -> "~8–9", "N/A" / "" -> null. */
export function fmtRpe(s: string | undefined): string | null {
  const t = (s ?? '').trim()
  if (!t || /^n\/?a$/i.test(t)) return null
  return fmtRange(t)
}

/**
 * Rest as a compact label: "2-3 min" -> "2–3′", "90 s" -> "90″", "1:30" -> "1:30". Unknown text is returned
 * unchanged (trimmed), so custom programs never lose information.
 */
export function fmtRestShort(rest: string | undefined): string {
  const t = (rest ?? '').trim()
  if (!t) return '—'
  if (/^\d+:\d{2}$/.test(t)) return t
  const m = t.match(/^(\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?)\s*(min|mins|minutes?|m|λεπτά?|')$/i)
  if (m) return `${fmtRange(m[1])}′`
  const s = t.match(/^(\d+(?:\s*-\s*\d+)?)\s*(s|sec|secs|seconds?|δευτ\.?|")$/i)
  if (s) return `${fmtRange(s[1])}″`
  return t
}

/** A typed weight for display: "57,5" -> "57.5" (en) / "57,5" (el); empty stays empty. */
export function fmtTypedWeight(w: string): string {
  const n = parseNum(w)
  return n == null ? w.trim() : fmtNum(n, 2)
}

/** Number of substitutions an exercise offers. */
export const swapCount = (e: { s1?: string; s2?: string }): number => (e.s1 ? 1 : 0) + (e.s2 ? 1 : 0)

/** Clock time in the current locale: "07:40". */
export const fmtTime = (ms: number): string =>
  new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' }).format(ms)

/** Separator between sets in "55 × 10, 55 × 9". */
export const setSeparator = (): string => ', '

/** A duration split for compact stat tiles ("48′", "1h 10′"): whole minutes, at least one. */
export function durationParts(ms: number): { h: number; m: number } {
  const min = Math.max(1, Math.round(ms / 60000))
  return { h: Math.floor(min / 60), m: min % 60 }
}

// Greek-aware helpers live in src/lib/text (shared with squad and the UI kit).
export { textLang, upperText } from '../../../lib/text'
