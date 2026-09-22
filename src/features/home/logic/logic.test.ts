import { describe, expect, it } from 'vitest'
import { at, meals, mkCheckin, mkLog, mkMember, mkPlan, mkWeight, squad } from '../../../lib/testing/fixtures'
import { dayPart, firstName, greetName, vocative } from './greeting'
import { allDone, athleteSteps, coachSteps, currentStep, doneCount } from './onboarding'
import { lastCheckin, squadToday, summarize } from './squadToday'
import { hasTrainingStats, onSchedulePct, prsInMonth } from './tiles'

describe('greeting', () => {
  it('splits the day per language', () => {
    expect(dayPart(7, 'en')).toBe('morning')
    expect(dayPart(12, 'en')).toBe('afternoon')
    expect(dayPart(12, 'el')).toBe('morning')
    expect(dayPart(13, 'el')).toBe('afternoon')
    expect(dayPart(18, 'en')).toBe('evening')
    expect(dayPart(23, 'el')).toBe('evening')
    // a late session is still "evening", not morning
    expect(dayPart(2, 'en')).toBe('evening')
    expect(dayPart(5, 'en')).toBe('morning')
  })

  it('uses the first name', () => {
    expect(firstName('Stelios Papadopoulos')).toBe('Stelios')
    expect(firstName('  Thanos ')).toBe('Thanos')
    expect(firstName('')).toBe('')
  })

  it('puts Greek names in the vocative and leaves Latin names alone', () => {
    expect(vocative('Στέλιος')).toBe('Στέλιο')
    expect(vocative('Θάνος')).toBe('Θάνο')
    expect(vocative('Κώστας')).toBe('Κώστα')
    expect(vocative('Γιάννης')).toBe('Γιάννη')
    expect(vocative('Παντελής')).toBe('Παντελή')
    expect(vocative('Μαρία')).toBe('Μαρία')
    expect(vocative('Stelios')).toBe('Stelios')
    expect(greetName('Στέλιος Παπαδόπουλος', 'el')).toBe('Στέλιο')
    expect(greetName('Στέλιος Παπαδόπουλος', 'en')).toBe('Στέλιος')
  })
})

describe('onboarding', () => {
  const fresh = { hasProgram: true, programStart: null, weighIns: 0, hasPlan: false, checkins: 0, planSeen: false }

  it('starts with nothing done and the start date first', () => {
    const s = athleteSteps(fresh)
    expect(doneCount(s)).toBe(0)
    expect(s.map((x) => x.waiting)).toEqual([false, false, true])
    expect(currentStep(s)).toBe('start')
  })

  it('waits for the coach when there is no program or plan, and skips to what the athlete can do', () => {
    const s = athleteSteps({ ...fresh, hasProgram: false })
    expect(s[0].waiting).toBe(true)
    expect(currentStep(s)).toBe('weigh')
  })

  it('counts the plan as checked once it was opened or a check-in exists', () => {
    expect(athleteSteps({ ...fresh, hasPlan: true }).find((x) => x.id === 'plan')?.done).toBe(false)
    expect(athleteSteps({ ...fresh, hasPlan: true, planSeen: true }).find((x) => x.id === 'plan')?.done).toBe(true)
    // opening the page without a plan doesn't count
    expect(athleteSteps({ ...fresh, planSeen: true }).find((x) => x.id === 'plan')?.done).toBe(false)
    expect(athleteSteps({ ...fresh, checkins: 1 }).find((x) => x.id === 'plan')?.done).toBe(true)
  })

  it('is all done for an active athlete', () => {
    const s = athleteSteps({ hasProgram: true, programStart: '2026-01-05', weighIns: 3, hasPlan: true, checkins: 4, planSeen: false })
    expect(allDone(s)).toBe(true)
    expect(currentStep(s)).toBeNull()
  })

  it('highlights nothing when only steps waiting on the coach are left', () => {
    const s = athleteSteps({ ...fresh, programStart: '2026-01-05', weighIns: 1 })
    expect(allDone(s)).toBe(false)
    expect(currentStep(s)).toBeNull()
  })

  it('tracks the coach set-up across athletes', () => {
    const a = mkMember({ id: 'a', programStart: '2026-01-05' })
    const b = mkMember({ id: 'b', joined: false })
    const coach = mkMember({ id: 'coach', role: 'coach', competes: false, programId: null })
    const s = coachSteps([a, b, coach], [mkPlan({ id: 'p', memberId: 'a', startDate: '2026-01-01', active: true })])
    expect(s.map((x) => [x.id, x.count, x.total, x.done])).toEqual([
      ['invite', 1, 2, false],
      ['start', 1, 2, false],
      ['plans', 1, 2, false],
    ])
    // no athletes yet: nothing is done
    expect(coachSteps([coach], []).every((x) => !x.done && x.total === 0)).toBe(true)
  })
})

describe('tiles', () => {
  it('counts PRs in the current calendar month', () => {
    expect(prsInMonth([{ date: '2026-09-01' }, { date: '2026-08-31' }, { date: '2026-09-22' }], '2026-09-24')).toBe(2)
  })

  it('rounds the on-schedule percentage and waits for the first due workout', () => {
    expect(onSchedulePct({ schedule: null })).toBeNull()
    expect(onSchedulePct({ schedule: { consistency: 0.916 } as never })).toBe(92)
  })

  it('hides the tiles until there is something to count', () => {
    expect(hasTrainingStats({ programWeek: 0, workoutsDone: 0, lastWorkoutAt: null, prs: [] })).toBe(false)
    expect(hasTrainingStats({ programWeek: 1, workoutsDone: 0, lastWorkoutAt: null, prs: [] })).toBe(true)
  })
})

describe('squadToday', () => {
  // MINI: Mon / Wed / Fri. Week 1 starts Monday 2026-01-05; 2026-01-07 is Wednesday (Lower).
  const START = '2026-01-05'
  const WED = '2026-01-07'

  it('tells who trained, who is training, who is due and who rests', () => {
    const done = mkMember({ id: 'done', programStart: START })
    const live = mkMember({ id: 'live', programStart: START })
    const due = mkMember({ id: 'due', programStart: START })
    const d = squad({
      members: [done, live, due, mkMember({ id: 'dennis', role: 'coach', competes: false, programId: null })],
      logs: [
        ...['done', 'live', 'due'].map((m) => mkLog({ member: m, week: 1, day: 0, doneAt: at(START, 8) })),
        mkLog({ member: 'done', week: 1, day: 1, doneAt: at(WED, 7) }),
        mkLog({
          member: 'live',
          week: 1,
          day: 1,
          done: false,
          startedAt: at(WED, 18),
          updatedAt: at(WED, 18, 20),
          ex: { 0: { sets: [['100', '5', true]] } },
        }),
      ],
      weights: ['done', 'live', 'due'].map((m) => mkWeight(m, WED, 80)),
    })
    const rows = squadToday(d, WED)
    const by = Object.fromEntries(rows.map((r) => [r.member.id, r.status]))
    expect(Object.keys(by).sort()).toEqual(['done', 'due', 'live'])
    expect(by.done).toEqual({ kind: 'done', dayName: 'Lower', at: at(WED, 7) })
    expect(by.live).toMatchObject({ kind: 'training', dayName: 'Lower' })
    expect(by.due).toEqual({ kind: 'due', dayName: 'Lower' })
    expect(summarize(rows)).toMatchObject({ athletes: 3, trainedToday: 1, scheduledToday: 3, behind: 0, staleWeighIns: 0 })
    // Tuesday is a rest day
    expect(squadToday(d, '2026-01-06').find((r) => r.member.id === 'due')?.status).toEqual({ kind: 'rest' })
  })

  it('puts athletes worth a nudge first', () => {
    const ok = mkMember({ id: 'aaron', programStart: START })
    const behind = mkMember({ id: 'zed', programStart: START })
    const d = squad({
      members: [ok, behind],
      logs: [mkLog({ member: 'aaron', week: 1, day: 0, doneAt: at(START) })],
      weights: [mkWeight('aaron', '2026-01-06', 80), mkWeight('zed', '2025-12-20', 80)],
    })
    const rows = squadToday(d, '2026-01-06')
    expect(rows.map((r) => r.member.id)).toEqual(['zed', 'aaron'])
    expect(rows[0]).toMatchObject({ push: true, behindBy: 1, staleWeighIn: true })
    expect(rows[1]).toMatchObject({ push: false, behindBy: 0, staleWeighIn: false })
  })

  it('reports set-up states before the program runs', () => {
    const later = mkMember({ id: 'later', programStart: '2026-02-02' })
    const none = mkMember({ id: 'none' })
    const noProgram = mkMember({ id: 'np', programId: null })
    const rows = squadToday(squad({ members: [later, none, noProgram] }), WED)
    const by = Object.fromEntries(rows.map((r) => [r.member.id, r.status]))
    expect(by.later).toEqual({ kind: 'startsOn', date: '2026-02-02' })
    expect(by.none).toEqual({ kind: 'noStart' })
    expect(by.np).toEqual({ kind: 'noProgram' })
    expect(rows.every((r) => !r.push)).toBe(true)
  })

  it('summarises the latest food check-in against its own plan', () => {
    const m = mkMember({ id: 'a', programStart: START })
    const plan = mkPlan({ id: 'p1', memberId: 'a', startDate: START, active: true, meals: meals('b', 'l', 'd', 's') })
    const d = squad({
      members: [m],
      mealPlans: [plan],
      checkins: [
        mkCheckin('a', '2026-01-05', { rating: 'off' }),
        mkCheckin('a', '2026-01-06', { meals: ['b', 'l', 'd'], planId: 'p1', rating: 'mostly' }),
      ],
    })
    expect(lastCheckin(d, m, WED)).toEqual({ date: '2026-01-06', rating: 'mostly', score: 0.75, meals: 3, mealsTotal: 4 })
    expect(lastCheckin(d, m, '2026-01-04')).toBeNull()
    expect(squadToday(d, WED)[0].hasPlan).toBe(true)
  })
})
