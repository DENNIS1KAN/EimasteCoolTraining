import { getLang, localeOf } from '../../i18n'
import type { ISODate } from '../../lib/dates'
import { fmtDate } from '../../lib/format'

/** Time of day in the current locale: "18:40". */
export function fmtTimeOfDay(ms: number): string {
  return new Intl.DateTimeFormat(localeOf(getLang()), { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms))
}

/** "Thu 24 Sep" / "Πέμ 24 Σεπ" (the eyebrow uppercases it). */
export const fmtEyebrowDate = (d: ISODate): string => `${fmtDate(d, 'weekday')} ${fmtDate(d, 'dayMonth')}`

/** Short month name for "PRs in Sep". */
export function fmtMonth(d: ISODate): string {
  const [y, m] = d.split('-').map(Number)
  return new Intl.DateTimeFormat(localeOf(getLang()), { month: 'short' }).format(new Date(y, m - 1, 15))
}
