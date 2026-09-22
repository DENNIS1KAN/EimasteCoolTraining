import { useId, useState } from 'react'
import type { MealPlan } from '../../data/types'
import { useT } from '../../i18n'
import { addDays } from '../../lib/dates'
import { fmtDate } from '../../lib/format'
import { ButtonLink, Card, Icon } from '../../ui'
import { byNewest } from './hooks'
import { FM } from './messages'
import { PlanSummary } from './PlanSummary'

/** "1 Aug – 14 Sep": a plan runs until the day before the next newer plan starts. */
export function planRange(plan: MealPlan, all: MealPlan[]): { from: string; to: string | null } {
  const newer = all
    .filter((p) => p.memberId === plan.memberId && p.id !== plan.id && p.startDate > plan.startDate)
    .sort(byNewest)
    .pop()
  return { from: plan.startDate, to: newer ? addDays(newer.startDate, -1) : null }
}

function OlderPlan({ plan, all, editTo }: { plan: MealPlan; all: MealPlan[]; editTo?: string }) {
  const t = useT(FM)
  const [open, setOpen] = useState(false)
  const id = useId()
  const r = planRange(plan, all)
  const when = r.to && r.to >= r.from ? t('range', { from: fmtDate(r.from), to: fmtDate(r.to) }) : t('since', { date: fmtDate(r.from) })
  const meals = plan.meals.length
  const meta = [when, meals ? (meals === 1 ? t('mealsOne') : t('mealsMany', { n: meals })) : null].filter(Boolean).join(' · ')
  return (
    <li className={`fu-older__item${open ? ' is-open' : ''}`}>
      <button type="button" className="fu-older__row" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className="fu-older__text">
          <span className="fu-older__title">{plan.title}</span>
          <span className="fu-older__meta">{meta}</span>
        </span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} />
      </button>
      {open && (
        <div id={id} className="fu-older__body">
          <PlanSummary plan={plan} />
          {editTo && (
            <ButtonLink to={editTo} variant="ghost" size="sm" icon="edit">
              {t('editPlan')}
            </ButtonLink>
          )}
        </div>
      )}
    </li>
  )
}

export interface OlderPlansProps {
  plans: MealPlan[]
  all: MealPlan[]
  /** Link to the editor for a plan, when the viewer may edit it. */
  editLink?: (plan: MealPlan) => string | undefined
}

/** Earlier plans, collapsed by default. */
export function OlderPlans({ plans, all, editLink }: OlderPlansProps) {
  const t = useT(FM)
  const [open, setOpen] = useState(false)
  const id = useId()
  if (!plans.length) return null
  return (
    <Card as="section" padding="none" className="fu-older">
      <h2 className="fu-older__h">
        <button type="button" className="fu-older__toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          <Icon name="history" size={18} />
          <span className="fu-older__label">{t('olderPlans')}</span>
          <span className="fu-older__n num">{plans.length}</span>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} />
        </button>
      </h2>
      {open && (
        <ul id={id} className="fu-older__list">
          {plans.map((p) => (
            <OlderPlan key={p.id} plan={p} all={all} editTo={editLink?.(p)} />
          ))}
        </ul>
      )}
    </Card>
  )
}
