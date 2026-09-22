import { useT } from '../../i18n'
import { update } from '../../data/store'
import type { Member, Unit } from '../../data/types'
import { Segmented } from '../../ui'
import { SETTINGS } from './messages'
import { Section } from './Section'

export function setUnit(me: Member, unit: Unit): void {
  if (me.settings.unit === unit) return
  update('members', me.id, (m) => ({ ...m, settings: { ...m.settings, unit } }))
}

/** kg / lb for body weight and new workouts (member.settings.unit). */
export function UnitsSection({ me }: { me: Member }) {
  const t = useT(SETTINGS)
  return (
    <Section id="units" icon="dumbbell-plate" title={t('units')} sub={t('unitsSub')}>
      <Segmented<Unit>
        block
        size="lg"
        ariaLabel={t('units')}
        value={me.settings.unit}
        onChange={(u) => setUnit(me, u)}
        options={[
          { value: 'kg', label: 'kg', sub: t('kilograms') },
          { value: 'lb', label: 'lb', sub: t('pounds') },
        ]}
      />
      <p className="set-note">{t('unitsNote')}</p>
    </Section>
  )
}
