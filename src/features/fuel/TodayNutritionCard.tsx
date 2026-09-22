import { useMemo } from 'react'
import { useT } from '../../i18n'
import { todayISO } from '../../lib/dates'
import { fmtNum } from '../../lib/format'
import { Card, Icon } from '../../ui'
import { ProgressRing } from '../../ui/charts'
import { useFuelData, useNow } from './hooks'
import { daySummary, minutesOf, nextMealId, planOnDate, ticksFor } from './lib/day'
import { FM } from './messages'
import './fuel-mini.css'

/** Home 2-up mini card: meals ticked today, kcal eaten of the target and the next meal. Taps through to /fuel. */
export function TodayNutritionCard(props: { memberId: string }) {
  const t = useT(FM)
  const now = useNow()
  const today = todayISO(now)
  const data = useFuelData(props.memberId)
  const checkin = data.byDate.get(today) ?? null
  const plan = planOnDate(data.plans, data.current, today, checkin, today)
  const ticked = useMemo(() => ticksFor(checkin, plan, data.plans), [checkin, plan, data.plans])
  const s = useMemo(() => daySummary(plan, ticked), [plan, ticked])
  const nextId = plan ? nextMealId(plan.meals, ticked, minutesOf(now)) : null
  const next = plan?.meals.find((m) => m.id === nextId) ?? null
  const rating = checkin?.rating ?? null

  const head = (
    <div className="fu-mini__head">
      <p className="eyebrow">{t('fuelToday')}</p>
      <Icon name="chevron-right" size={16} className="fu-mini__chev" />
    </div>
  )

  if (!plan) {
    return (
      <Card to="/fuel" className="fu-mini fu-mini--empty" aria-label={`${t('fuelToday')}: ${t('noPlanYet')}`}>
        {head}
        <div className="fu-mini__none">
          <span className="fu-mini__noneic" aria-hidden="true">
            <Icon name="fuel" size={18} />
          </span>
          <p className="fu-mini__nonet">{t('noPlanYet')}</p>
        </div>
        <p className="fu-mini__foot">
          {rating ? (
            <>
              <Icon name="check" size={14} />
              {t('ratedAs', { rating: t(rating) })}
            </>
          ) : (
            t('noPlanHome')
          )}
        </p>
      </Card>
    )
  }

  const hasMeals = s.mealsTotal > 0
  const hasKcal = s.kcalEaten != null && s.kcalTarget != null
  const aria = [
    t('fuelToday'),
    hasMeals ? t('mealsOf', { x: s.mealsTicked, y: s.mealsTotal }) : null,
    hasKcal ? `${fmtNum(s.kcalEaten ?? 0, 0)} ${t('ofKcal', { n: fmtNum(s.kcalTarget ?? 0, 0) })}` : null,
    next ? `${t('next')}: ${next.name}${next.time ? ` ${next.time}` : ''}` : null,
    rating ? t('ratedAs', { rating: t(rating) }) : null,
  ]
    .filter(Boolean)
    .join(', ')

  let foot = null
  if (next) {
    foot = (
      <>
        <Icon name="clock" size={14} />
        <span className="truncate">
          {next.name}
          {next.time ? ` · ${next.time}` : ''}
        </span>
      </>
    )
  } else if (hasMeals && s.mealsTicked === s.mealsTotal) {
    foot = (
      <>
        <Icon name="check" size={14} />
        <span className="truncate">{t('allDone')}</span>
      </>
    )
  } else if (rating) {
    foot = (
      <>
        <Icon name="check" size={14} />
        <span className="truncate">{t('ratedAs', { rating: t(rating) })}</span>
      </>
    )
  }

  return (
    <Card to="/fuel" className="fu-mini" aria-label={aria}>
      {head}
      <div className="fu-mini__body" aria-hidden="true">
        {hasMeals && (
          <ProgressRing
            value={s.mealsTicked / s.mealsTotal}
            size={48}
            stroke={5.5}
            color="var(--accent-strong)"
            trackColor="var(--surface-3)"
            ariaLabel=""
          >
            <span className="fu-mini__ring num">
              {s.mealsTicked}/{s.mealsTotal}
            </span>
          </ProgressRing>
        )}
        <div className="fu-mini__nums">
          {hasKcal ? (
            <>
              <p className="fu-mini__v num">{fmtNum(s.kcalEaten ?? 0, 0)}</p>
              <p className="fu-mini__s">{t('ofKcal', { n: fmtNum(s.kcalTarget ?? 0, 0) })}</p>
            </>
          ) : hasMeals ? (
            <p className="fu-mini__s">{t('mealsOf', { x: s.mealsTicked, y: s.mealsTotal })}</p>
          ) : (
            <p className="fu-mini__s fu-mini__plan">{plan.title}</p>
          )}
        </div>
      </div>
      {foot && (
        <p className="fu-mini__foot" aria-hidden="true">
          {foot}
        </p>
      )}
    </Card>
  )
}

export default TodayNutritionCard
