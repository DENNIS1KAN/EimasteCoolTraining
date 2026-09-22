import type { MealPlan } from '../../data/types'
import { useT } from '../../i18n'
import { fmtNum } from '../../lib/format'
import { Chip } from '../../ui'
import { PlanFiles } from './PlanFiles'
import { PlanNotes } from './PlanNotes'
import { FM } from './messages'

/** Target chips: "2,400 kcal", "P 180 g", "C 250 g", "F 70 g", "3 L". */
export function TargetChips({ plan }: { plan: MealPlan }) {
  const t = useT(FM)
  const chips: string[] = []
  if (plan.kcal != null) chips.push(`${fmtNum(plan.kcal, 0)} kcal`)
  if (plan.protein != null) chips.push(`${t('proteinShort')} ${fmtNum(plan.protein, 0)} g`)
  if (plan.carbs != null) chips.push(`${t('carbsShort')} ${fmtNum(plan.carbs, 0)} g`)
  if (plan.fat != null) chips.push(`${t('fatShort')} ${fmtNum(plan.fat, 0)} g`)
  if (plan.waterL != null) chips.push(`${fmtNum(plan.waterL, 2)} L`)
  if (!chips.length) return null
  return (
    <div className="fu-chips">
      {chips.map((c) => (
        <Chip key={c} size="sm">
          {c}
        </Chip>
      ))}
    </div>
  )
}

/** Read-only view of a whole plan (used for earlier plans). */
export function PlanSummary({ plan }: { plan: MealPlan }) {
  return (
    <div className="fu-summary">
      <TargetChips plan={plan} />
      {plan.meals.length > 0 && (
        <ol className="fu-summary__meals">
          {plan.meals.map((m) => (
            <li key={m.id}>
              <div className="fu-summary__meal">
                <span className="fu-summary__name">
                  {m.name}
                  {m.time && <span className="fu-meal__time">{m.time}</span>}
                </span>
                {m.kcal != null && (
                  <span className="fu-meal__kcal num">
                    {fmtNum(m.kcal, 0)}
                    <small>kcal</small>
                  </span>
                )}
              </div>
              {m.items.trim() && <p className="fu-summary__foods">{m.items.split('\n').filter(Boolean).join(', ')}</p>}
            </li>
          ))}
        </ol>
      )}
      <PlanFiles files={plan.files} />
      <PlanNotes text={plan.notes} />
    </div>
  )
}
