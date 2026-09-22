/**
 * Calendar-date helpers. An ISO date is "YYYY-MM-DD" interpreted in the device's local time zone.
 * All arithmetic goes through local-noon Date objects so DST shifts never move a date.
 */
export type ISODate = string

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local noon on that calendar day. */
export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0)
}

export const isISODate = (s: unknown): s is ISODate =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromISODate(s).getTime())

/** Today's date; `now` is injectable for tests. */
export const todayISO = (now: Date = new Date()): ISODate => toISODate(now)

export const isoFromMs = (ms: number): ISODate => toISODate(new Date(ms))

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86400000)
}

/** Monday of the week containing the date. */
export function startOfWeek(s: ISODate): ISODate {
  const d = fromISODate(s)
  const dow = (d.getDay() + 6) % 7 // Monday = 0
  return addDays(s, -dow)
}

/** Inclusive list of dates from a to b. */
export function dateRange(a: ISODate, b: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d)
  return out
}

/** The next Monday on or after the date. */
export function nextMonday(s: ISODate): ISODate {
  const d = fromISODate(s)
  const dow = (d.getDay() + 6) % 7
  return dow === 0 ? s : addDays(s, 7 - dow)
}

export const minDate = (a: ISODate, b: ISODate): ISODate => (a < b ? a : b)
export const maxDate = (a: ISODate, b: ISODate): ISODate => (a > b ? a : b)
