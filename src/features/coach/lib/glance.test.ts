import { describe, expect, it } from 'vitest'
import { at, MINI, mkCheckin, mkLog, mkMember, mkPlan, mkWeight, meals, squad } from '../../../lib/testing/fixtures'
import { athleteGlance, glanceTotals, lastActiveAt, squadGlance, trainees } from './glance'

// MINI: 2 weeks x 3 days on Mon / Wed / Fri. Start Monday 2026-01-05.
const START = '2026-01-05'

describe('athleteGlance', () => {
  it('flags an athlete behind schedule with a stale weigh-in', () => {
    const m = mkMember({ id: 'a', programStart: START })
    // today is Saturday of week 1: Mon, Wed and Fri were due, only Monday done
    const d = squad({
      members: [m],
      logs: [mkLog({ member: 'a', week: 1, day: 0, doneAt: at('2026-01-05') })],
      weights: [mkWeight('a', '2025-12-29', 80)],
    })
    const g = athleteGlance(d, m, '2026-01-10')
    expect(g.weekDone).toBe(1)
    expect(g.weekTarget).toBe(3)
    expect(g.weekDueSoFar).toBe(3)
    expect(g.behindBy).toBe(2)
    expect(g.daysSinceWeighIn).toBe(12)
    expect(g.flags).toEqual(['behind', 'noWeighIn'])
  })

  it('is clean when on track', () => {
    const m = mkMember({ id: 'a', programStart: START })
    const d = squad({
      members: [m],
      logs: [mkLog({ member: 'a', week: 1, day: 0, doneAt: at('2026-01-05') }), mkLog({ member: 'a', week: 1, day: 1, doneAt: at('2026-01-07') })],
      weights: [mkWeight('a', '2026-01-07', 80)],
    })
    const g = athleteGlance(d, m, '2026-01-08')
    expect(g.flags).toEqual([])
    expect(g.weekDueSoFar).toBe(2)
    expect(g.daysSinceWeighIn).toBe(1)
  })

  it('asks for a start date or a program', () => {
    const noStart = mkMember({ id: 'a' })
    const noProgram = mkMember({ id: 'b', programId: null })
    const d = squad({ members: [noStart, noProgram] })
    expect(athleteGlance(d, noStart, '2026-01-08').flags).toEqual(['notStarted', 'noWeighIn'])
    expect(athleteGlance(d, noProgram, '2026-01-08').flags).toEqual(['noProgram', 'noWeighIn'])
    expect(athleteGlance(d, noStart, '2026-01-08').weekTarget).toBe(3)
  })

  it('warns about low nutrition adherence', () => {
    const m = mkMember({ id: 'a', programStart: START })
    const plan = mkPlan({ id: 'p', memberId: 'a', startDate: '2026-01-01', active: true, meals: meals('m1', 'm2') })
    const d = squad({
      members: [m],
      mealPlans: [plan],
      checkins: [mkCheckin('a', '2026-01-06', { meals: ['m1'] })],
      weights: [mkWeight('a', '2026-01-07', 80)],
    })
    const g = athleteGlance(d, m, '2026-01-07')
    expect(g.adherence).toBeLessThan(0.6)
    expect(g.flags).toContain('lowFood')
  })
})

describe('squadGlance', () => {
  it('lists athletes (not a coach without a program), most urgent first', () => {
    const coach = mkMember({ id: 'coach', role: 'coach', programId: null, competes: false })
    const ok = mkMember({ id: 'zed', programStart: START })
    const late = mkMember({ id: 'amy', programStart: START })
    const d = squad({
      members: [coach, ok, late],
      logs: [
        mkLog({ member: 'zed', week: 1, day: 0, doneAt: at('2026-01-05') }),
        mkLog({ member: 'zed', week: 1, day: 1, doneAt: at('2026-01-07') }),
      ],
      weights: [mkWeight('zed', '2026-01-07', 80), mkWeight('amy', '2026-01-07', 70)],
    })
    expect(trainees(d).map((m) => m.id)).toEqual(['amy', 'zed'])
    const rows = squadGlance(d, '2026-01-08')
    expect(rows.map((r) => r.member.id)).toEqual(['amy', 'zed'])
    const totals = glanceTotals(rows)
    expect(totals).toMatchObject({ athletes: 2, onTrack: 1, weekDone: 2, weekTarget: 6, adherence: null })
  })
})

describe('lastActiveAt', () => {
  it('takes the latest write of any kind', () => {
    const d = squad({
      members: [mkMember({ id: 'a' })],
      logs: [mkLog({ member: 'a', week: 1, day: 0, doneAt: at('2026-01-05') })],
      weights: [mkWeight('a', '2026-01-09', 80)],
    })
    expect(lastActiveAt(d, 'a')).toBe(at('2026-01-09', 7))
    expect(lastActiveAt(d, 'nobody')).toBeNull()
  })
})

describe('MINI fixture sanity', () => {
  it('has 3 days a week', () => expect(MINI.weeks[0].days).toHaveLength(3))
})
