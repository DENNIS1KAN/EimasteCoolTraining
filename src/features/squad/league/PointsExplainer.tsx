import { useT } from '../../../i18n'
import { POINTS } from '../../../lib/stats'
import { Card, Icon, type IconName } from '../../../ui'
import { SQ } from '../messages'

const RULES: { key: keyof typeof POINTS; label: 'ruleWorkout' | 'rulePr' | 'rulePerfect' | 'ruleWeighIn' | 'ruleOnPlan'; icon: IconName }[] = [
  { key: 'workout', label: 'ruleWorkout', icon: 'train' },
  { key: 'pr', label: 'rulePr', icon: 'trophy' },
  { key: 'perfectWeek', label: 'rulePerfect', icon: 'calendar-check' },
  { key: 'weighIn', label: 'ruleWeighIn', icon: 'scale' },
  { key: 'onPlanDay', label: 'ruleOnPlan', icon: 'fuel' },
]

/** "How points work": the scoring rules, collapsible (open by default while nobody has points yet). */
export function PointsExplainer({ defaultOpen }: { defaultOpen?: boolean }) {
  const t = useT(SQ)
  return (
    <Card as="section" padding="none" className="sq-rules">
      <details open={defaultOpen}>
        <summary className="sq-rules__sum">
          <span className="sq-rules__icon" aria-hidden="true">
            <Icon name="info" size={18} />
          </span>
          <span className="sq-rules__title">
            <span className="sq-rules__h">{t('howPoints')}</span>
            <span className="sq-rules__sub">{t('howPointsSub')}</span>
          </span>
          <Icon name="chevron-down" size={18} className="sq-rules__chev" />
        </summary>
        <ul className="sq-rules__list">
          {RULES.map((r) => (
            <li key={r.key}>
              <Icon name={r.icon} size={16} />
              <span>{t(r.label)}</span>
              <b className="sq-rules__pts num">+{POINTS[r.key]}</b>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  )
}
