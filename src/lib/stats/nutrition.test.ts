import { describe, expect, it } from 'vitest'
import { DST_SPRING, meals, mkCheckin, mkPlan } from '../testing/fixtures'
import { adherence, checkinPlan, checkinScore, currentPlan, onPlanStreak } from './nutrition'

const plan = mkPlan({ id: 'p1', memberId: 'stelios', startDate: '2026-03-25', active: true, meals: meals('b', 'l', 's', 'd') })
const C = (date: string, p: Parameters<typeof mkCheckin>[2] = {}) => mkCheckin('stelios', date, p)

describe('currentPlan', () => {
  it('prefers the active plan, else the one that started last', () => {
    const old = mkPlan({ id: 'old', memberId: 'stelios', startDate: '2026-01-01' })
    const newer = mkPlan({ id: 'newer', memberId: 'stelios', startDate: '2026-02-01' })
    const active = mkPlan({ id: 'act', memberId: 'stelios', startDate: '2025-12-01', active: true })
    expect(currentPlan([old, newer, active], 'stelios')?.id).toBe('act')
    expect(currentPlan([old, newer], 'stelios')?.id).toBe('newer')
    expect(currentPlan([newer, old], 'stelios')?.id).toBe('newer')
  })

  it("ignores other members' plans", () => {
    expect(currentPlan([mkPlan({ id: 'x', memberId: 'thanos', startDate: '2026-01-01', active: true })], 'stelios')).toBeNull()
    expect(currentPlan([], 'stelios')).toBeNull()
  })

  it('does not reorder the caller array', () => {
    const list = [mkPlan({ id: 'a', memberId: 's', startDate: '2026-01-01' }), mkPlan({ id: 'b', memberId: 's', startDate: '2026-02-01' })]
    currentPlan(list, 's')
    expect(list.map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('checkinScore', () => {
  it('is 0 without a check-in', () => {
    expect(checkinScore(undefined, plan)).toBe(0)
  })

  it('uses the fraction of planned meals ticked', () => {
    expect(checkinScore(C('2026-03-25', { meals: ['b', 'l'] }), plan)).toBe(0.5)
    expect(checkinScore(C('2026-03-25', { meals: ['b', 'l', 's', 'd'], rating: 'off' }), plan)).toBe(1)
  })

  it('ignores ticked ids that are not in the plan and does not double count duplicates', () => {
    expect(checkinScore(C('2026-03-25', { meals: ['b', 'zzz'] }), plan)).toBe(0.25)
    expect(checkinScore(C('2026-03-25', { meals: ['b', 'b', 'b', 'b'] }), plan)).toBe(0.25)
  })

  it('falls back to the rating when no meal is ticked or the plan has no meals', () => {
    expect(checkinScore(C('2026-03-25', { rating: 'on' }), plan)).toBe(1)
    expect(checkinScore(C('2026-03-25', { rating: 'mostly' }), plan)).toBe(0.5)
    expect(checkinScore(C('2026-03-25', { rating: 'off' }), plan)).toBe(0)
    expect(checkinScore(C('2026-03-25', { rating: null }), plan)).toBe(0)
    const noMeals = { ...plan, meals: [] }
    expect(checkinScore(C('2026-03-25', { meals: ['b'], rating: 'mostly' }), noMeals)).toBe(0.5)
    expect(checkinScore(C('2026-03-25', { rating: 'on' }), null)).toBe(1)
  })

  it('falls back to the rating when the ticked meals belong to another plan (e.g. before a plan change)', () => {
    expect(checkinScore(C('2026-03-20', { meals: ['old-1', 'old-2'], rating: 'on' }), plan)).toBe(1)
  })
})

describe('checkinPlan', () => {
  const old = mkPlan({ id: 'old', memberId: 'stelios', startDate: '2026-03-01', meals: meals('a') })
  const theirs = mkPlan({ id: 'theirs', memberId: 'thanos', startDate: '2026-03-01', meals: meals('a') })
  const plans = { [old.id]: old, [plan.id]: plan, [theirs.id]: theirs }

  it("uses the check-in's own plan when it still exists, else the fallback", () => {
    expect(checkinPlan(C('2026-03-10', { planId: 'old' }), plans, plan)?.id).toBe('old')
    expect(checkinPlan(C('2026-03-10', { planId: 'deleted' }), plans, plan)?.id).toBe('p1')
    expect(checkinPlan(C('2026-03-10'), plans, plan)?.id).toBe('p1')
    expect(checkinPlan(C('2026-03-10'), plans, null)).toBeNull()
  })

  it("never scores against another member's plan", () => {
    expect(checkinPlan(C('2026-03-10', { planId: 'theirs' }), plans, plan)?.id).toBe('p1')
  })
})

describe('adherence', () => {
  it('is null without a plan', () => {
    expect(adherence([], null, '2026-03-20', '2026-03-30')).toBeNull()
  })

  it('does not count days before the plan started', () => {
    expect(adherence([C('2026-03-20', { rating: 'on' })], plan, '2026-03-10', '2026-03-24')).toEqual({ days: 0, logged: 0, ratio: 0, byDay: [] })
    const a = adherence([C('2026-03-20', { rating: 'off' }), C('2026-03-25', { rating: 'on' })], plan, '2026-03-17', '2026-03-26')!
    expect(a.days).toBe(2)
    expect(a.byDay.map((d) => d.date)).toEqual(['2026-03-25', '2026-03-26'])
    expect(a).toMatchObject({ logged: 1, ratio: 0.5 })
  })

  it('counts missing days as 0 and spans DST correctly', () => {
    const cs = [C('2026-03-27', { rating: 'on' }), C(DST_SPRING, { meals: ['b', 'l', 's'] }), C('2026-03-30', { rating: 'mostly' })]
    const a = adherence(cs, plan, '2026-03-27', '2026-03-31')!
    expect(a.days).toBe(5)
    expect(a.byDay.map((d) => d.score)).toEqual([1, 0, 0.75, 0.5, 0])
    expect(a.logged).toBe(3)
    expect(a.ratio).toBeCloseTo(2.25 / 5, 10)
  })

  it("ignores other members' check-ins", () => {
    const a = adherence([mkCheckin('thanos', '2026-03-25', { rating: 'on' })], plan, '2026-03-25', '2026-03-25')!
    expect(a).toMatchObject({ days: 1, logged: 0, ratio: 0 })
  })
})

describe('onPlanStreak', () => {
  const good = ['2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', DST_SPRING].map((d) => C(d, { rating: 'on' }))

  it('counts consecutive good days ending today, across DST', () => {
    expect(onPlanStreak(good, plan, DST_SPRING)).toBe(5)
  })

  it('starts from yesterday while today is not logged (or not good yet)', () => {
    expect(onPlanStreak(good, plan, '2026-03-30')).toBe(5)
    expect(onPlanStreak([...good, C('2026-03-30', { rating: 'mostly' })], plan, '2026-03-30')).toBe(5)
    expect(onPlanStreak(good, plan, '2026-03-31')).toBe(0)
  })

  it('a day at 0.75 breaks the streak; 0.8 is the bar', () => {
    const cs = [C('2026-03-25', { rating: 'on' }), C('2026-03-26', { meals: ['b', 'l', 's'] }), C('2026-03-27', { rating: 'on' })]
    expect(onPlanStreak(cs, plan, '2026-03-27')).toBe(1)
  })

  it('never reaches back before the plan start', () => {
    const early = [C('2026-03-23', { rating: 'on' }), C('2026-03-24', { rating: 'on' }), ...good]
    expect(onPlanStreak(early, plan, DST_SPRING)).toBe(5)
  })

  it('is 0 without a plan', () => {
    expect(onPlanStreak(good, null, DST_SPRING)).toBe(0)
  })
})
