import { useMemo, useState } from 'react'
import { useStore } from '../../data/store'
import { useT } from '../../i18n'
import { dismissHint, usePrefs } from '../../lib/prefs'
import { Button, celebrate } from '../../ui'
import { Checklist, type ChecklistItem } from './Checklist'
import { HINT_COACH, allDone, coachSteps, currentStep } from './logic/onboarding'
import { HM } from './messages'

/**
 * The coach's set-up checklist for a new squad: invite the athletes, give them a start date, upload meal plans.
 * Shown until everything is in place (or dismissed on this device).
 */
export function CoachSetup() {
  const t = useT(HM)
  const prefs = usePrefs()
  const members = useStore((s) => s.members)
  const plans = useStore((s) => s.mealPlans)
  const steps = useMemo(() => coachSteps(Object.values(members), Object.values(plans)), [members, plans])
  const [armed] = useState(() => !allDone(steps))
  if (prefs.dismissed[HINT_COACH] || !armed) return null

  const current = currentStep(steps)
  const items: ChecklistItem[] = steps.map((s) => {
    const base = { id: s.id, done: s.done, waiting: false, current: s.id === current }
    const n = s.count ?? 0
    const total = s.total ?? 0
    switch (s.id) {
      case 'invite':
        return { ...base, title: t('csInvite'), sub: total ? t('csInviteBody', { n, total }) : t('csInviteNone'), to: '/coach' }
      case 'start':
        return { ...base, title: t('csStart'), sub: t('csStartBody', { n, total }), to: '/coach' }
      case 'plans':
        return { ...base, title: t('csPlans'), sub: t('csPlansBody', { n, total }), to: '/coach?tab=nutrition' }
    }
  })

  const finish = () => {
    celebrate({ intensity: 'small' })
    dismissHint(HINT_COACH)
  }

  return (
    <Checklist
      eyebrow={t('csEyebrow')}
      title={t('csTitle')}
      items={items}
      dismissLabel={t('csDismiss')}
      onDismiss={() => dismissHint(HINT_COACH)}
      doneState={
        <div className="home-check__done">
          <p className="home-check__done-title">{t('allGood')}</p>
          <Button size="sm" icon="bolt" onClick={finish}>
            {t('obGotIt')}
          </Button>
        </div>
      }
    />
  )
}
