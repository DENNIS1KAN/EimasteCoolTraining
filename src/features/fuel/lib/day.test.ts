import { describe, expect, it } from 'vitest'
import type { Meal, MealPlan } from '../../../data/types'
import { blankCheckin, daySummary, isBlankCheckin, mealMinutes, nextMealId, nextRating, planOnDate, toggleMeal } from './day'

const meal = (id: string, time: string, kcal: number | null = null, protein: number | null = null): Meal => ({
  id,
  name: id,
  time,
  items: '',
  kcal,
  protein,
})

const plan = (meals: Meal[], extra: Partial<MealPlan> = {}): MealPlan => ({
  id: 'p1',
  memberId: 'm1',
  title: 'Plan',
  notes: '',
  startDate: '2026-09-01',
  kcal: null,
  protein: null,
  carbs: null,
  fat: null,
  waterL: null,
  meals,
  files: [],
  active: true,
  createdBy: 'c',
  createdAt: 0,
  updatedAt: 0,
  ...extra,
})

describe('mealMinutes', () => {
  it('parses HH:MM and H:MM', () => {
    expect(mealMinutes('08:00')).toBe(480)
    expect(mealMinutes('8:05')).toBe(485)
    expect(mealMinutes(' 21:30 ')).toBe(1290)
  })
  it('rejects anything else', () => {
    expect(mealMinutes('')).toBeNull()
    expect(mealMinutes('25:00')).toBeNull()
    expect(mealMinutes('noon')).toBeNull()
    expect(mealMinutes(undefined)).toBeNull()
  })
})

describe('nextMealId', () => {
  const meals = [meal('b', '08:00'), meal('l', '14:00'), meal('s', '17:30'), meal('d', '20:30')]
  it('picks the earliest open meal that is not long overdue', () => {
    expect(nextMealId(meals, [], 9 * 60 + 41)).toBe('l')
    expect(nextMealId(meals, [], 7 * 60)).toBe('b')
    expect(nextMealId(meals, ['b', 'l'], 12 * 60)).toBe('s')
  })
  it('keeps an overdue meal within the grace period', () => {
    expect(nextMealId(meals, ['b'], 14 * 60 + 50)).toBe('l')
    expect(nextMealId(meals, ['b'], 15 * 60 + 1)).toBe('s')
  })
  it('returns null when everything is ticked or long past', () => {
    expect(nextMealId(meals, ['b', 'l', 's', 'd'], 10 * 60)).toBeNull()
    expect(nextMealId(meals, [], 23 * 60)).toBeNull()
  })
  it('falls back to plan order when no meal has a time', () => {
    expect(nextMealId([meal('x', ''), meal('y', '')], ['x'], 600)).toBe('y')
  })
  it('ignores untimed meals when others have a time', () => {
    expect(nextMealId([meal('x', ''), meal('y', '10:00')], [], 600)).toBe('y')
  })
})

describe('daySummary', () => {
  const meals = [meal('b', '08:00', 600, 40), meal('l', '14:00', 800, 50), meal('d', '20:00', 600, 30)]

  it('sums ticked meals and uses the plan target', () => {
    const s = daySummary(plan(meals, { kcal: 2400, protein: 180, carbs: 250, fat: 70 }), ['b', 'l', 'ghost'])
    expect(s.mealsTotal).toBe(3)
    expect(s.mealsTicked).toBe(2)
    expect(s.kcalPlanned).toBe(2000)
    expect(s.kcalEaten).toBe(1400)
    expect(s.kcalTarget).toBe(2400)
    expect(s.kcalLeft).toBe(1000)
    expect(s.macros[0]).toEqual({ key: 'protein', target: 180, eaten: 90, mode: 'exact' })
    // carbs and fat are estimated from the share of planned kcal eaten (1400 / 2000)
    expect(s.macros[1]).toEqual({ key: 'carbs', target: 250, eaten: 175, mode: 'estimate' })
    expect(s.macros[2]).toEqual({ key: 'fat', target: 70, eaten: 49, mode: 'estimate' })
  })

  it('falls back to the meals total as the kcal target', () => {
    const s = daySummary(plan(meals), ['d'])
    expect(s.kcalTarget).toBe(2000)
    expect(s.kcalLeft).toBe(1400)
    expect(s.macros[0]).toEqual({ key: 'protein', target: 120, eaten: 30, mode: 'exact' })
    expect(s.macros[1]).toEqual({ key: 'carbs', target: null, eaten: null, mode: 'target' })
  })

  it('shows only targets when meals carry no numbers', () => {
    const s = daySummary(plan([meal('a', ''), meal('b', '')], { kcal: 2000, protein: 150 }), ['a'])
    expect(s.kcalEaten).toBeNull()
    expect(s.kcalLeft).toBeNull()
    expect(s.kcalTarget).toBe(2000)
    expect(s.macros[0]).toEqual({ key: 'protein', target: 150, eaten: null, mode: 'target' })
  })

  it('handles no plan', () => {
    const s = daySummary(null, [])
    expect(s).toMatchObject({ mealsTotal: 0, mealsTicked: 0, kcalTarget: null, kcalLeft: null })
  })

  it('goes negative when over target', () => {
    expect(daySummary(plan(meals, { kcal: 1500 }), ['b', 'l', 'd']).kcalLeft).toBe(-500)
  })
})

describe('check-in helpers', () => {
  it('creates, toggles and detects blank rows', () => {
    const c = blankCheckin('m1', '2026-09-22', null)
    expect(c.id).toBe('m1__2026-09-22')
    expect(isBlankCheckin(c)).toBe(true)
    const t = toggleMeal(c, 'b', 'p1')
    expect(t.meals).toEqual(['b'])
    expect(t.planId).toBe('p1')
    expect(isBlankCheckin(t)).toBe(false)
    expect(toggleMeal(t, 'b', 'p1').meals).toEqual([])
  })
  it('toggles the rating off when picked again', () => {
    expect(nextRating(null, 'on')).toBe('on')
    expect(nextRating('on', 'on')).toBeNull()
    expect(nextRating('on', 'off')).toBe('off')
  })
})

describe('planOnDate', () => {
  const old = plan([], { id: 'old', startDate: '2026-08-01', active: false })
  const cur = plan([], { id: 'cur', startDate: '2026-09-10' })
  const next = plan([], { id: 'next', startDate: '2026-10-01', active: false })
  const plans = [next, cur, old]
  it('prefers the plan of the check-in', () => {
    expect(planOnDate(plans, cur, '2026-09-20', { ...blankCheckin('m1', '2026-09-20', 'old') })?.id).toBe('old')
  })
  it('uses the current plan once it started, else the newest started plan', () => {
    expect(planOnDate(plans, cur, '2026-09-20')?.id).toBe('cur')
    expect(planOnDate(plans, cur, '2026-09-01')?.id).toBe('old')
  })
  it('falls back to the current plan before any plan started', () => {
    expect(planOnDate(plans, cur, '2026-07-01')?.id).toBe('cur')
    expect(planOnDate([], null, '2026-07-01')).toBeNull()
  })
  it('ignores a check-in whose plan is gone', () => {
    expect(planOnDate(plans, cur, '2026-09-20', blankCheckin('m1', '2026-09-20', 'deleted'))?.id).toBe('cur')
  })
})
