import { LOCALE } from '../../i18n'
import { fmtDuration } from '../../lib/format'

/** Time of day in the current locale: "18:40". */
export function fmtTime(ms: number): string {
  return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms))
}

/** A session's duration as the Finish sheet shows it: never under "1 min" (a quick session doesn't read "0 min"). */
export const fmtSessionDuration = (ms: number): string => fmtDuration(Math.max(60_000, ms))

/** "5–2" with an en dash. */
export const fmtScore = (a: number, b: number): string => `${a}–${b}`

/** Program week + progress: "W3 · 11/60". */
export const fmtProgress = (weekLabel: string, done: number, total: number): string => `${weekLabel} · ${done}/${total}`

/** Human list: "A, B and C" / "Α, Β και Γ". */
export function fmtList(names: string[]): string {
  try {
    return new Intl.ListFormat(LOCALE, { style: 'long', type: 'conjunction' }).format(names)
  } catch {
    return names.join(', ')
  }
}

/** Link to the head-to-head page. */
export const compareHref = (a: { slug: string }, b: { slug: string }): string =>
  `/squad/compare?a=${encodeURIComponent(a.slug)}&b=${encodeURIComponent(b.slug)}`

export const memberHref = (m: { slug: string }): string => `/member/${encodeURIComponent(m.slug)}`
/**
 * A logged workout (read-only view). `programId` is the program the log belongs to, which can differ from the
 * member's current one after the coach moves them to another program; it rides along as `?program=`.
 */
export const memberWorkoutHref = (m: { slug: string }, week: number, day: number, programId?: string | null): string =>
  `/member/${encodeURIComponent(m.slug)}/workout/${week}/${day}${programId ? `?program=${encodeURIComponent(programId)}` : ''}`
export const liftHref = (m: { slug: string }, exercise: string): string =>
  `/lift/${encodeURIComponent(m.slug)}/${encodeURIComponent(exercise)}`
