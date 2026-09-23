import { describe, expect, it } from 'vitest'
import type { Meal, MealPlan } from '../../../data/types'
import { daySummary } from './day'
import { checkTarget, mealTotals, planTotals, sumMacros, withDerivedTotals } from './macros'

const food = (id: string, kcal: number, protein: number, carbs: number, fat: number) => ({ id, name: id, grams: 100, kcal, protein, carbs, fat })
const withFoods: Meal = { id: 'a', name: 'Lunch', time: '14:00', items: '', kcal: 1, protein: 1, foods: [food('x', 330, 62, 0, 7.2), food('y', 325, 6.8, 70.5, 0.8)] }
const old: Meal = { id: 'b', name: 'Dinner', time: '21:00', items: 'Fish\nSalad', kcal: 600, protein: 45 }

describe('meal totals', () => {
  it('sums foods, which win over the typed totals', () => {
    expect(mealTotals(withFoods)).toEqual({ kcal: 655, protein: 68.8, carbs: 70.5, fat: 8 })
    expect(withDerivedTotals(withFoods)).toMatchObject({ kcal: 655, protein: 68.8, carbs: 70.5, fat: 8 })
  })
  it('reads old meals (kcal and protein only)', () => {
    expect(mealTotals(old)).toEqual({ kcal: 600, protein: 45, carbs: null, fat: null })
    expect(planTotals([withFoods, old])).toEqual({ kcal: 1255, protein: 113.8, carbs: 70.5, fat: 8 })
  })
  it('keeps a column null only when nothing has it', () => {
    expect(sumMacros([{ kcal: null }, { kcal: 5 }])).toEqual({ kcal: 5, protein: null, carbs: null, fat: null })
  })
  it('checks totals against targets with a tolerance', () => {
    expect(checkTarget('kcal', 2321, 2400).verdict).toBe('on')
    expect(checkTarget('kcal', 2621, 2400)).toMatchObject({ verdict: 'over', diff: 221 })
    expect(checkTarget('protein', 150, 180)).toMatchObject({ verdict: 'under', diff: -30 })
    expect(checkTarget('fat', 70, null).verdict).toBeNull()
  })
})

describe('daySummary with food lists', () => {
  const plan = { id: 'p', kcal: 2400, protein: 180, carbs: 250, fat: 70, meals: [withFoods, old] } as MealPlan
  it('uses real carbs and fat from ticked meals', () => {
    const s = daySummary(plan, ['a'])
    expect(s.kcalEaten).toBe(655)
    expect(s.macros.map((m) => [m.key, m.eaten, m.mode])).toEqual([
      ['protein', 68.8, 'exact'],
      ['carbs', 70.5, 'exact'],
      ['fat', 8, 'exact'],
    ])
  })
  it('still estimates for old plans', () => {
    const s = daySummary({ ...plan, meals: [old] }, ['b'])
    expect(s.macros.find((m) => m.key === 'carbs')).toMatchObject({ mode: 'estimate', eaten: 250 })
  })
})
