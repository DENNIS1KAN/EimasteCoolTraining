import { useId, useState } from 'react'
import { Icon, SectionTitle, Tag, Tabs, cx } from '../../../ui'
import { useT } from '../../../i18n'
import { COMMON } from '../../../i18n/common'
import type { Program, ProgramWeek } from '../../../data/types'
import { dayFocus, dayShortName } from '../../../data/programs'
import { blockGroups, focusAbbr } from '../lib/programs'
import { M } from '../messages'
import { ExerciseTable } from './ExerciseTable'

/** Weeks grouped by block; one open at a time, showing its days as tabs and each day's exercises. */
export function WeeksAccordion({ program }: { program: Program }) {
  const t = useT(M)
  const [open, setOpen] = useState<number | null>(1)
  const groups = blockGroups(program)

  return (
    <section className="weeks" aria-labelledby="program-weeks-title">
      <SectionTitle title={<span id="program-weeks-title">{t('weeksTitle')}</span>} />
      {groups.map((g) => (
        <div key={`${g.block}-${g.weeks[0]}`} className="weeks__block">
          {g.block ? (
            <p className="weeks__block-label">
              <span>{g.block}</span>
            </p>
          ) : null}
          <ul className="weeks__list">
            {g.weeks.map((n) => (
              <WeekItem key={n} n={n} week={program.weeks[n - 1]} open={open === n} onToggle={() => setOpen(open === n ? null : n)} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function WeekItem({ n, week, open, onToggle }: { n: number; week: ProgramWeek; open: boolean; onToggle: () => void }) {
  const t = useT(M)
  const tc = useT(COMMON)
  const id = useId()
  const exercises = week.days.reduce((a, d) => a + d.ex.length, 0)
  return (
    <li className={cx('week-item', open && 'is-open')}>
      <h3 className="week-item__h">
        <button type="button" className="week-item__head" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
          <span className="week-item__num num" aria-hidden="true">
            {n}
          </span>
          <span className="week-item__text">
            <span className="week-item__title">{tc('weekN', { n })}</span>
            <span className="week-item__meta">
              {t('daysN', { n: week.days.length })} · {t('exercisesN', { n: exercises })}
            </span>
          </span>
          {week.intro ? <Tag tone="accent">{t('intro')}</Tag> : null}
          <Icon name="chevron-down" size={20} className="week-item__chev" />
        </button>
      </h3>
      {open ? (
        <div id={`${id}-body`} className="week-item__body">
          <WeekDays week={week} n={n} />
        </div>
      ) : null}
    </li>
  )
}

function WeekDays({ week, n }: { week: ProgramWeek; n: number }) {
  const t = useT(M)
  const [day, setDay] = useState(0)
  const uid = useId()
  const d = week.days[Math.min(day, week.days.length - 1)]
  if (!d) return null
  const focus = dayFocus(d)
  return (
    <div className="week-days">
      {week.days.length > 1 ? (
        <Tabs<number>
          options={week.days.map((x, i) => ({ value: i, label: dayShortName(x), sub: focusAbbr(x.name) || undefined, ariaLabel: x.name }))}
          value={day}
          onChange={setDay}
          size={week.days.some((x) => focusAbbr(x.name)) ? 'lg' : 'md'}
          ariaLabel={t('dayTabs', { n })}
          block
          controls={() => `${uid}-panel`}
          tabId={(v) => `${uid}-tab-${v}`}
        />
      ) : null}
      <div id={`${uid}-panel`} role={week.days.length > 1 ? 'tabpanel' : undefined} aria-labelledby={week.days.length > 1 ? `${uid}-tab-${day}` : undefined}>
        <div className="week-days__head">
          <p className="week-days__name">{dayShortName(d)}</p>
          {focus ? <p className="week-days__focus">{focus}</p> : null}
          <p className="week-days__count">{t('exercisesInDay', { n: d.ex.length })}</p>
        </div>
        <ExerciseTable day={d} />
      </div>
    </div>
  )
}
