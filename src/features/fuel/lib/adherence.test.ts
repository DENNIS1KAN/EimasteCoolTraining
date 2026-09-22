import { describe, expect, it } from 'vitest'
import type { Meal, MealPlan, NutritionCheckin } from '../../../data/types'
import { dayClosed, fuelDays, heatRange, lastCheckinDate, loggedAverage, ratingStreak, recentAdherence } from './adherence'

const meal = (id: string): Meal => ({ id, name: id, time: '', items: '', kcal: null, protein: null })
const plan = (id: string, startDate: string, meals: string[], active = true): MealPlan => ({
  id,
  memberId: 'm',
  title: id,
  notes: '',
  startDate,
  kcal: null,
  protein: null,
  carbs: null,
  fat: null,
  waterL: null,
  meals: meals.map(meal),
  files: [],
  active,
  createdBy: 'c',
  createdAt: 0,
  updatedAt: 0,
})
const ci = (date: string, meals: string[], rating: NutritionCheckin['rating'] = null, planId: string | null = null): NutritionCheckin => ({
  id: `m__${date}`,
  memberId: 'm',
  date,
  planId,
  meals,
  rating,
  waterL: null,
  note: '',
  updatedAt: 0,
})

describe('heatRange', () => {
  it('covers whole weeks ending with the current one', () => {
    // 2026-09-22 is a Tuesday
    expect(heatRange('2026-09-22', 4)).toEqual({ from: '2026-08-31', to: '2026-09-27' })
    expect(heatRange('2026-09-21', 1)).toEqual({ from: '2026-09-21', to: '2026-09-27' })
  })
})

describe('fuelDays', () => {
  const old = plan('old', '2026-09-01', ['a', 'b'], false)
  const cur = plan('cur', '2026-09-10', ['x', 'y', 'z', 'w'])
  const plans = { old, cur }

  it('scores each day against its own plan, zero-fills since the first plan and leaves the future empty', () => {
    const days = fuelDays(
      [ci('2026-09-02', ['a'], null, 'old'), ci('2026-09-11', ['x', 'y', 'z'], null, 'cur'), ci('2026-09-12', [], 'mostly', 'cur')],
      plans,
      cur,
      '2026-08-31',
      '2026-09-13',
      '2026-09-12',
    )
    const by = Object.fromEntries(days.map((d) => [d.date, d]))
    expect(by['2026-08-31'].value).toBeNull()
    expect(by['2026-09-01'].value).toBe(0)
    expect(by['2026-09-02']).toMatchObject({ value: 0.5, ticked: 1, total: 2, logged: true })
    expect(by['2026-09-11']).toMatchObject({ value: 0.75, ticked: 3, total: 4 })
    expect(by['2026-09-12']).toMatchObject({ value: 0.5, rating: 'mostly' })
    expect(by['2026-09-13'].value).toBeNull()
  })

  it('shows rating-only days without any plan', () => {
    const days = fuelDays([ci('2026-09-02', [], 'on')], {}, null, '2026-09-01', '2026-09-02', '2026-09-02')
    expect(days.map((d) => d.value)).toEqual([null, 1])
  })
})

describe('dayClosed', () => {
  const p = plan('p', '2026-09-01', ['a', 'b'])
  it('needs a rating or every meal', () => {
    expect(dayClosed(undefined, p)).toBe(false)
    expect(dayClosed(ci('2026-09-02', ['a']), p)).toBe(false)
    expect(dayClosed(ci('2026-09-02', ['a', 'b']), p)).toBe(true)
    expect(dayClosed(ci('2026-09-02', [], 'off'), p)).toBe(true)
    expect(dayClosed(ci('2026-09-02', []), null)).toBe(false)
  })
})

describe('recentAdherence', () => {
  const p = plan('p', '2026-09-01', ['a', 'b'])
  it('leaves an open today out of the window', () => {
    const cs = [ci('2026-09-09', ['a', 'b']), ci('2026-09-10', ['a'])]
    const a = recentAdherence(cs, p, '2026-09-10', 2)!
    expect(a.days).toBe(2)
    expect(a.byDay.map((d) => d.date)).toEqual(['2026-09-08', '2026-09-09'])
    expect(a.ratio).toBe(0.5)
  })
  it('includes today once it is closed', () => {
    const cs = [ci('2026-09-09', ['a', 'b']), ci('2026-09-10', [], 'on')]
    const a = recentAdherence(cs, p, '2026-09-10', 2)!
    expect(a.byDay.map((d) => d.date)).toEqual(['2026-09-09', '2026-09-10'])
    expect(a.ratio).toBe(1)
  })
  it('has no number yet for a plan that starts today (until today is closed)', () => {
    const a = recentAdherence([ci('2026-09-01', ['a'])], p, '2026-09-01', 14)!
    expect(a.days).toBe(0)
  })
  it('keeps counting days logged under the previous plan after a new one starts', () => {
    const v2 = plan('v2', '2026-09-01', ['a', 'b'], false)
    const v3 = plan('v3', '2026-09-10', ['x', 'y'])
    const cs = [ci('2026-09-08', ['a', 'b'], null, 'v2'), ci('2026-09-09', ['a', 'b'], null, 'v2')]
    const a = recentAdherence(cs, v3, '2026-09-10', 2, { v2, v3 })!
    expect(a.byDay.map((d) => d.date)).toEqual(['2026-09-08', '2026-09-09'])
    expect(a.ratio).toBe(1)
  })
  it('is null without a plan', () => {
    expect(recentAdherence([], null, '2026-09-01', 14)).toBeNull()
  })
})

describe('lastCheckinDate', () => {
  it('finds the latest date for the member', () => {
    expect(lastCheckinDate([ci('2026-09-02', []), ci('2026-09-05', []), { ...ci('2026-09-09', []), memberId: 'x' }], 'm')).toBe('2026-09-05')
    expect(lastCheckinDate([], 'm')).toBeNull()
  })
})

describe('without a plan', () => {
  it('counts a rating streak', () => {
    const cs = [ci('2026-09-08', [], 'on'), ci('2026-09-09', [], 'on'), ci('2026-09-10', [], 'mostly'), ci('2026-09-11', [], 'on')]
    expect(ratingStreak(cs, '2026-09-12')).toBe(1)
    expect(ratingStreak(cs, '2026-09-11')).toBe(1)
    expect(ratingStreak(cs.slice(0, 2), '2026-09-10')).toBe(2)
    expect(ratingStreak([], '2026-09-10')).toBe(0)
  })
  it('averages the logged days', () => {
    const days = fuelDays([ci('2026-09-02', [], 'on'), ci('2026-09-03', [], 'mostly')], {}, null, '2026-09-01', '2026-09-04', '2026-09-04')
    expect(loggedAverage(days)).toBe(0.75)
    expect(loggedAverage([])).toBeNull()
  })
})
