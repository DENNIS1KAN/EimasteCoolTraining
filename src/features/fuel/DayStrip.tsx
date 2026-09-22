import { useT } from '../../i18n'
import { addDays, fromISODate, type ISODate } from '../../lib/dates'
import { fmtDate, fmtDayLabel } from '../../lib/format'
import { FM } from './messages'

export interface DayStripProps {
  today: ISODate
  value: ISODate
  onChange: (date: ISODate) => void
  /** Per-day state for the dot under each day: 'full' (on plan), 'part' (logged), or nothing. */
  status: (date: ISODate) => 'full' | 'part' | null
  days?: number
}

/** The last 7 days as a strip, so a forgotten day can still be filled in. */
export function DayStrip({ today, value, onChange, status, days = 7 }: DayStripProps) {
  const t = useT(FM)
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)))
  return (
    <div className="fu-days" role="group" aria-label={t('daysAria')}>
      {dates.map((d) => {
        const st = status(d)
        const label = fmtDayLabel(d)
        return (
          <button
            key={d}
            type="button"
            className={`fu-day${d === value ? ' is-on' : ''}${d === today ? ' is-today' : ''}`}
            aria-pressed={d === value}
            aria-label={st ? t('dayLoggedAria', { day: label }) : t('dayOpenAria', { day: label })}
            onClick={() => onChange(d)}
          >
            <span className="fu-day__wd">{fmtDate(d, 'weekday').replace('.', '')}</span>
            <span className="fu-day__n num">{fromISODate(d).getDate()}</span>
            <span className={`fu-day__dot${st ? ` is-${st}` : ''}`} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
