import { useId, useMemo } from 'react'
import { useT } from '../../i18n'
import { fmtDayLabel, fmtNum, fmtPct } from '../../lib/format'
import { Card, Icon } from '../../ui'
import { Heatmap } from '../../ui/charts'
import type { FuelDay } from './lib/adherence'
import { FM } from './messages'

export interface AdherenceCardProps {
  days: FuelDay[]
  /** 0..1, or null when there is nothing to average yet. */
  ratio: number | null
  streak: number
}

/** Last 4 weeks: adherence %, on-plan streak and a day-by-day heatmap. */
export function AdherenceCard({ days, ratio, streak }: AdherenceCardProps) {
  const t = useT(FM)
  const headId = useId()
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])
  const counted = days.filter((d) => d.value != null).length
  const logged = days.filter((d) => d.logged).length
  const heat = useMemo(() => days.map((d) => ({ date: d.date, value: d.value })), [days])
  const tip = (date: string) => {
    const d = byDate.get(date)
    const day = fmtDayLabel(date)
    if (!d || d.value == null) return t('tipFuture', { date: day })
    if (!d.logged) return t('tipNone', { date: day })
    if (d.total > 0 && (d.ticked > 0 || !d.rating)) return t('tipMeals', { date: day, x: d.ticked, y: d.total })
    if (d.rating) return t('tipRated', { date: day, rating: t(d.rating) })
    return t('tipNone', { date: day })
  }
  const pct = ratio == null ? '–' : fmtPct(ratio)
  return (
    <Card as="section" className="fu-adh" aria-labelledby={headId}>
      <div className="fu-adh__stats">
        <h2 id={headId} className="visually-hidden">
          {t('adherence')}
        </h2>
        <div>
          <p className="fu-adh__v num">
            {ratio == null ? '–' : fmtNum(ratio * 100, 0)}
            {ratio != null && <small>%</small>}
          </p>
          <p className="fu-adh__k">
            {t('adherence')}
            <br />
            {t('last4w')}
          </p>
        </div>
        {counted > 0 && <p className="fu-adh__logged">{t('daysLogged', { x: logged, y: counted })}</p>}
        <p className={`fu-adh__streak${streak > 0 ? ' is-on' : ''}`}>
          <Icon name="flame" size={16} />
          <span>{streak > 0 ? t(streak === 1 ? 'streakOne' : 'streakMany', { n: streak }) : t('noStreak')}</span>
        </p>
      </div>
      <div className="fu-adh__heat">
        <Heatmap
          days={heat}
          color="var(--heat)"
          max={1}
          maxCell={20}
          ariaLabel={t('heatAria', { pct })}
          formatTooltip={(d) => tip(d.date)}
          formatValue={(n) => fmtPct(n)}
          valueLabel={t('scoreLabel')}
          table="hidden"
        />
      </div>
    </Card>
  )
}
