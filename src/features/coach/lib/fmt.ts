import type { ISODate } from '../../../lib/dates'
import { fmtDate } from '../../../lib/format'

/** Keep "21 Sep" on one line: a no-break space between a day number and its month. */
const glue = (s: string): string => s.replace(/(\d) (?=\p{L})/gu, '$1 ')

/** "Mon 8 Sep" / "Δευ 8 Σεπ" */
export const fmtDayDate = (d: ISODate): string => `${fmtDate(d, 'weekday')} ${fmtDate(d, 'dayMonth')}`

/**
 * A date range that only breaks between its ends: "21–27 Sep" within a month, "29 Sep – 5 Oct" across two
 * (day numbers and months are glued with no-break spaces).
 */
export function fmtDayRange(from: ISODate, to: ISODate): string {
  const end = glue(fmtDate(to, 'dayMonth'))
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8, 10))}–${end}`
  return `${glue(fmtDate(from, 'dayMonth'))} – ${end}`
}
