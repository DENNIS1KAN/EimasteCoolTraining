import { useMemo } from 'react'
import { useT } from '../../i18n'
import { update, useStore } from '../../data/store'
import type { Member, WeightVisibility } from '../../data/types'
import { fmtSigned, fmtWeight } from '../../lib/format'
import { weightStats } from '../../lib/stats'
import { kgToUnit } from '../../lib/units'
import { Icon, type IconName } from '../../ui'
import { SETTINGS, type SettingsKey } from './messages'
import { Section } from './Section'

const OPTIONS: { value: WeightVisibility; icon: IconName; title: SettingsKey; body: SettingsKey }[] = [
  { value: 'exact', icon: 'eye', title: 'visExact', body: 'visExactBody' },
  { value: 'change', icon: 'chart', title: 'visChange', body: 'visChangeBody' },
  { value: 'private', icon: 'lock', title: 'visPrivate', body: 'visPrivateBody' },
]

/** Who sees my body weight (settings.weightVisibility), with a live preview of what the squad sees. */
export function PrivacySection({ me }: { me: Member }) {
  const t = useT(SETTINGS)
  const weights = useStore((s) => s.weights)
  const stats = useMemo(
    () =>
      weightStats(
        Object.values(weights).filter((w) => w.memberId === me.id),
        me.programStart,
      ),
    [weights, me.id, me.programStart],
  )
  const vis = me.settings.weightVisibility
  const unit = me.settings.unit
  const set = (v: WeightVisibility) => {
    if (v !== vis) update('members', me.id, (m) => ({ ...m, settings: { ...m.settings, weightVisibility: v } }))
  }

  // What the squad sees: a number in the display face, or a quiet sentence.
  let value: string | null = null
  let caption: string
  if (vis === 'private') caption = t('seesNothing')
  else if (!stats) caption = t('seesNoData')
  else if (vis === 'exact') {
    value = fmtWeight(stats.latestKg, unit)
    caption = ''
  } else {
    value = `${fmtSigned(kgToUnit(stats.changeKg, unit))} ${unit}`
    caption = t('seesSinceStart')
  }

  return (
    <Section id="privacy" icon="eye" title={t('privacy')} sub={t('privacySub')}>
      <div className="set-choices" role="radiogroup" aria-label={t('privacy')}>
        {OPTIONS.map((o) => (
          <label key={o.value} className={['set-choice', vis === o.value && 'is-on'].filter(Boolean).join(' ')}>
            <input
              className="visually-hidden"
              type="radio"
              name="weight-visibility"
              value={o.value}
              checked={vis === o.value}
              onChange={() => set(o.value)}
            />
            <span className="set-choice__icon" aria-hidden="true">
              <Icon name={o.icon} size={18} />
            </span>
            <span className="set-choice__text">
              <span className="set-choice__title">{t(o.title)}</span>
              <span className="set-choice__body">{t(o.value === 'private' && me.role === 'coach' ? 'visPrivateBodyCoach' : o.body)}</span>
            </span>
            <span className="set-choice__radio" aria-hidden="true">
              <Icon name="check" size={13} strokeWidth={2.6} />
            </span>
          </label>
        ))}
      </div>
      <div className="set-preview" aria-live="polite">
        <span className="micro">{t('squadSees')}</span>
        <span className="set-preview__out">
          {value ? <span className="set-preview__value">{value}</span> : null}
          {caption ? <span className="set-preview__caption">{caption}</span> : null}
        </span>
      </div>
    </Section>
  )
}
