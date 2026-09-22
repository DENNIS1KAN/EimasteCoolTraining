import type { Member, Unit } from '../../../data/types'
import { useT } from '../../../i18n'
import { fmtNum, fmtSigned, fmtWeight } from '../../../lib/format'
import { kgToUnit } from '../../../lib/units'
import type { WeightStats } from '../../../lib/stats'
import { Delta, Icon } from '../../../ui'
import type { WeightAccess } from '../logic/visibility'
import { changeDir, weightChangeTone } from '../logic/weight'
import { SQ } from '../messages'

export interface WeightSummaryProps {
  member: Member
  weight: WeightStats | null
  access: WeightAccess
  /** The viewer's unit. */
  unit: Unit
  /** Show the current weight next to the change (when allowed). */
  showValue?: boolean
  className?: string
}

/** Weight as the viewer may see it: "80.9 kg ↓1.5 kg", only "↓1.5 kg" (change), "Private", or "—" before the first weigh-in. */
export function WeightSummary({ member, weight, access, unit, showValue = true, className }: WeightSummaryProps) {
  const t = useT(SQ)
  if (access === 'hidden') {
    return (
      <span className={`sq-weight sq-weight--private${className ? ` ${className}` : ''}`}>
        <Icon name="lock" size={12} strokeWidth={2.2} />
        {t('weightPrivate')}
      </span>
    )
  }
  if (!weight) {
    // A dash in the numeral style, like the other empty stats; the words are for screen readers and on hover.
    return (
      <span className={`sq-weight sq-weight--none num${className ? ` ${className}` : ''}`} title={t('noWeighIn')}>
        <span aria-hidden="true">—</span>
        <span className="visually-hidden">{t('noWeighIn')}</span>
      </span>
    )
  }
  const change = weight.changeKg
  const delta = (
    <Delta
      text={`${fmtNum(kgToUnit(Math.abs(change), unit), 1)} ${unit}`}
      dir={changeDir(change)}
      tone={weightChangeTone(change, weight.startKg, member.goalWeightKg)}
    />
  )
  return (
    <span className={`sq-weight${className ? ` ${className}` : ''}`}>
      {access === 'exact' && showValue ? <span className="sq-weight__v num">{fmtWeight(weight.trendKg, unit)}</span> : null}
      {delta}
    </span>
  )
}

/** Short text for a weight line (VS card sub-line): "80.9 kg", "−1.5 kg" or "". */
export function weightText(weight: WeightStats | null, access: WeightAccess, unit: Unit): string {
  if (!weight || access === 'hidden') return ''
  if (access === 'exact') return fmtWeight(weight.trendKg, unit)
  return `${fmtSigned(kgToUnit(weight.changeKg, unit))} ${unit}`
}
