import type { Program } from '../../../data/types'
import { useT } from '../../../i18n'
import { COMMON } from '../../../i18n/common'
import type { ISODate } from '../../../lib/dates'
import { addDays } from '../../../lib/dates'
import { fmtDate } from '../../../lib/format'
import { cx } from '../../../ui'
import { weeklyPattern } from '../lib/programs'
import { M } from '../messages'

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export interface PatternStripProps {
  program: Pick<Program, 'schedule' | 'weeks'>
  /** Program start: labels the slots with real weekdays. Without it the week is assumed to start on a Monday. */
  start?: ISODate | null
  label: string
}

/** The weekly pattern as 7 chips: weekday on top, the workout (or rest) below. */
export function PatternStrip({ program, start, label }: PatternStripProps) {
  const t = useT(M)
  const tc = useT(COMMON)
  const slots = weeklyPattern(program)
  return (
    <ol className="pattern-strip" aria-label={label}>
      {slots.map((s) => {
        const wd = start ? fmtDate(addDays(start, s.slot), 'weekday') : tc(WEEKDAYS[s.slot])
        const rest = s.day == null
        return (
          <li key={s.slot} className={cx('pattern-chip', rest ? 'is-rest' : 'is-train')}>
            <span className="pattern-chip__wd">{wd}</span>
            <span className="pattern-chip__day">{rest ? t('rest') : s.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
