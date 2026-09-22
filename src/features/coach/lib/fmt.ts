import type { ISODate } from '../../../lib/dates'
import { fmtDate } from '../../../lib/format'

/** "Mon 8 Sep" / "Δευ 8 Σεπ" */
export const fmtDayDate = (d: ISODate): string => `${fmtDate(d, 'weekday')} ${fmtDate(d, 'dayMonth')}`
