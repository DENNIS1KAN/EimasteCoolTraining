import { useMemo, useState } from 'react'
import { useStore } from '../../data/store'
import type { Member } from '../../data/types'
import { useT } from '../../i18n'
import { fmtDate } from '../../lib/format'
import { dismissHint, usePrefs } from '../../lib/prefs'
import { Button, Sheet, celebrate } from '../../ui'
import { LogWeightSheet } from '../body/LogWeightSheet'
import { StartProgramForm } from '../train/StartProgram'
import { Checklist, type ChecklistItem } from './Checklist'
import { HINT_ATHLETE, HINT_PLAN_SEEN, allDone, athleteSteps, currentStep } from './logic/onboarding'
import { HM } from './messages'

/**
 * Fresh-account checklist: set the start date, log the first weigh-in, check the meal plan.
 * Hidden when everything is already done on arrival; if the last step gets done while it is on screen,
 * it turns into a short "all set" card instead of vanishing. Dismissible (per device).
 */
export function AthleteOnboarding({ me, coach }: { me: Member; coach: Member | null }) {
  const t = useT(HM)
  const prefs = usePrefs()
  const program = useStore((s) => (me.programId ? (s.programs[me.programId] ?? null) : null))
  const weighIns = useStore((s) => {
    let n = 0
    for (const w of Object.values(s.weights)) if (w.memberId === me.id) n++
    return n
  })
  const checkins = useStore((s) => {
    let n = 0
    for (const c of Object.values(s.checkins)) if (c.memberId === me.id) n++
    return n
  })
  const hasPlan = useStore((s) => Object.values(s.mealPlans).some((p) => p.memberId === me.id && p.active))
  const planSeen = !!prefs.dismissed[HINT_PLAN_SEEN]
  const dismissed = !!prefs.dismissed[HINT_ATHLETE]

  const steps = useMemo(
    () => athleteSteps({ hasProgram: !!program, programStart: me.programStart, weighIns, hasPlan, checkins, planSeen }),
    [program, me.programStart, weighIns, hasPlan, checkins, planSeen],
  )
  const [armed] = useState(() => !allDone(steps))
  const [sheet, setSheet] = useState<'start' | 'weigh' | null>(null)
  // The weigh-in sheet computes the weight model: mount it on first use only.
  const [weighUsed, setWeighUsed] = useState(false)

  if (dismissed || !armed) return null

  const coachName = coach?.name ?? t('theCoach')
  const current = currentStep(steps)
  const items: ChecklistItem[] = steps.map((s) => {
    const base = { id: s.id, done: s.done, waiting: s.waiting, current: s.id === current }
    switch (s.id) {
      case 'start':
        return {
          ...base,
          title: t('obStart'),
          sub: s.done
            ? t('obStartDone', { date: fmtDate(me.programStart!, 'long') })
            : s.waiting
              ? t('obStartWaiting', { coach: coachName })
              : t('obStartBody', { program: program?.name ?? '' }),
          onClick: () => setSheet('start'),
        }
      case 'weigh':
        return {
          ...base,
          title: t('obWeigh'),
          sub: s.done ? t('obWeighDone') : t('obWeighBody'),
          onClick: () => {
            setWeighUsed(true)
            setSheet('weigh')
          },
        }
      case 'plan':
        return {
          ...base,
          title: t('obPlan'),
          sub: s.done ? t('obPlanDone') : s.waiting ? t('obPlanWaiting', { coach: coachName }) : t('obPlanBody', { coach: coachName }),
          to: '/fuel',
          onClick: () => dismissHint(HINT_PLAN_SEEN),
        }
    }
  })

  const finish = () => {
    celebrate({ intensity: 'small' })
    dismissHint(HINT_ATHLETE)
  }

  return (
    <>
      <Checklist
        eyebrow={t('obEyebrow')}
        title={t('obTitle')}
        items={items}
        dismissLabel={t('obDismiss')}
        onDismiss={() => dismissHint(HINT_ATHLETE)}
        doneState={
          <div className="home-check__done">
            <div>
              <p className="home-check__done-title">{t('obAllSet')}</p>
              <p className="home-check__done-body">{t('obAllSetBody')}</p>
            </div>
            <Button size="sm" icon="bolt" onClick={finish}>
              {t('obGotIt')}
            </Button>
          </div>
        }
      />
      {program ? (
        <Sheet open={sheet === 'start'} onClose={() => setSheet(null)} title={t('startSheetTitle')} subtitle={program.name}>
          <StartProgramForm me={me} program={program} onSaved={() => setSheet(null)} />
        </Sheet>
      ) : null}
      {weighUsed ? <LogWeightSheet open={sheet === 'weigh'} onClose={() => setSheet(null)} /> : null}
    </>
  )
}
