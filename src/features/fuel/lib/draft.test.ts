import { describe, expect, it } from 'vitest'
import type { MealPlan } from '../../../data/types'
import {
  bumpTitle,
  customFoodDraft,
  draftFromPlan,
  draftPlanTotals,
  draftMacroKcal,
  draftMealsKcal,
  duplicateDraft,
  emptyDraft,
  foodDraftOf,
  hasErrors,
  kcalFromMacros,
  mealDraftTotals,
  moveItem,
  othersToDeactivate,
  planFromDraft,
  resetFoodMacros,
  setFoodByPiece,
  setFoodGrams,
  setFoodMacro,
  setFoodPieces,
  validateDraft,
  type FoodDraft,
  type MealDraft,
} from './draft'
import { foodById } from '../foods'

const base: MealPlan = {
  id: 'p1',
  memberId: 'm',
  title: 'Cut phase · v2',
  notes: '# Rules\n- No soda',
  startDate: '2026-09-01',
  kcal: 2400,
  protein: 180,
  carbs: 250,
  fat: 70,
  waterL: 3,
  meals: [{ id: 'a', name: 'Breakfast', time: '08:00', items: 'Oats\nWhey', kcal: 600, protein: 40, carbs: null, fat: null }],
  files: [{ path: 'm/x.pdf', name: 'x.pdf', type: 'application/pdf', size: 10 }],
  active: false,
  createdBy: 'c',
  createdAt: 5,
  updatedAt: 9,
}

describe('draft round trip', () => {
  it('converts a plan to a draft and back', () => {
    const d = draftFromPlan(base)
    expect(d.kcal).toBe('2400')
    expect(d.meals[0].kcal).toBe('600')
    const p = planFromDraft(d, base)
    expect({ ...p, updatedAt: 9 }).toEqual(base)
  })

  it('cleans up typed values', () => {
    const d = {
      ...emptyDraft('2026-09-22'),
      title: '  Bulk ',
      waterL: '2,5',
      meals: [{ id: 'm1', name: ' Lunch ', time: '9:30', items: ' rice \n\n chicken ', kcal: '', protein: '45', carbs: '60', fat: '', foods: [] }],
    }
    const p = planFromDraft(d, { id: 'n', memberId: 'm', createdBy: 'c', createdAt: 1 })
    expect(p.title).toBe('Bulk')
    expect(p.waterL).toBe(2.5)
    expect(p.kcal).toBeNull()
    expect(p.meals[0]).toEqual({ id: 'm1', name: 'Lunch', time: '09:30', items: 'rice\nchicken', kcal: null, protein: 45, carbs: 60, fat: null })
  })
})

describe('bumpTitle', () => {
  it('increments a version suffix or adds one', () => {
    expect(bumpTitle('Cut phase · v2')).toBe('Cut phase · v3')
    expect(bumpTitle('Plan v9')).toBe('Plan v10')
    expect(bumpTitle('Lean bulk')).toBe('Lean bulk · v2')
    expect(bumpTitle('')).toBe('')
  })
})

describe('duplicateDraft', () => {
  it('copies content with new meal ids, starting today and active', () => {
    let n = 0
    const withFoods: MealPlan = {
      ...base,
      meals: [{ ...base.meals[0], foods: [{ id: 'f', name: 'Oats', grams: 80, kcal: 303, protein: 10.6, carbs: 54.2, fat: 5.2, ref: 'oats' }] }],
    }
    const d = duplicateDraft(withFoods, '2026-09-22', () => `new-${++n}`)
    expect(d.meals[0].foods).toHaveLength(1)
    expect(d.meals[0].foods[0]).toMatchObject({ id: 'new-2', ref: 'oats', grams: '80', kcal: '303', manual: false })
    expect(d.title).toBe('Cut phase · v3')
    expect(d.startDate).toBe('2026-09-22')
    expect(d.active).toBe(true)
    expect(d.meals[0].id).toBe('new-1')
    expect(d.meals[0].name).toBe('Breakfast')
    expect(d.files).toEqual(base.files)
    expect(d.files).not.toBe(base.files)
  })
})

describe('kcal helpers', () => {
  it('computes kcal from macros', () => {
    expect(kcalFromMacros(180, 250, 70)).toBe(2350)
    expect(kcalFromMacros(null, null, null)).toBeNull()
    expect(kcalFromMacros(100, null, null)).toBe(400)
    expect(draftMacroKcal({ protein: '180', carbs: '250', fat: '70,5' })).toBe(2355)
  })
  it('sums meal kcal', () => {
    expect(draftMealsKcal([])).toBeNull()
    expect(draftMealsKcal(draftFromPlan(base).meals)).toBe(600)
  })
})

describe('validateDraft', () => {
  it('accepts a good draft', () => {
    expect(hasErrors(validateDraft(draftFromPlan(base)))).toBe(false)
  })
  it('flags missing title, bad numbers and bad meals', () => {
    const d = { ...draftFromPlan(base), title: ' ', kcal: 'abc', fat: '-3', startDate: '2026-02-30' }
    d.meals = [{ ...d.meals[0], name: '', time: '25:00', kcal: '99999' }]
    const e = validateDraft(d)
    expect(e.fields).toEqual({ title: 'required', kcal: 'number', fat: 'range', startDate: 'date' })
    expect(e.meals.a).toEqual({ name: 'required', time: 'time', kcal: 'range' })
    expect(hasErrors(e)).toBe(true)
  })
})

describe('othersToDeactivate', () => {
  it('finds the member’s other active plans', () => {
    const plans = [
      { ...base, id: 'a', active: true },
      { ...base, id: 'b', active: true },
      { ...base, id: 'c', active: false },
      { ...base, id: 'd', active: true, memberId: 'other' },
    ]
    expect(othersToDeactivate(plans, 'm', 'a').map((p) => p.id)).toEqual(['b'])
  })
})

describe('moveItem', () => {
  it('moves and ignores out-of-range', () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3])
    expect(moveItem([1, 2, 3], 2, 1)).toEqual([1, 3, 2])
    const arr = [1, 2]
    expect(moveItem(arr, 1, 2)).toBe(arr)
  })
})

describe('food lists', () => {
  const food = (ref: string) => {
    const f = foodById(ref)
    if (!f) throw new Error(ref)
    return f
  }
  const meal = (foods: FoodDraft[]): MealDraft => ({ id: 'm', name: 'Lunch', time: '', items: '', kcal: '', protein: '', carbs: '', fat: '', foods })

  it('picks a food: 100 g, or one piece for foods counted by the piece', () => {
    const chicken = foodDraftOf(food('chicken-breast-cooked'), 'Chicken', 'c')
    expect(chicken).toMatchObject({ grams: '100', pieces: '', kcal: '165', protein: '31', carbs: '0', fat: '3.6', manual: false })
    const egg = foodDraftOf(food('egg'), 'Egg', 'e')
    expect(egg).toMatchObject({ grams: '50', pieces: '1', kcal: '72', protein: '6.3' })
  })

  it('recomputes macros from grams and pieces', () => {
    const rice = setFoodGrams(foodDraftOf(food('rice-white-cooked'), 'Rice', 'r'), '250')
    expect(rice).toMatchObject({ kcal: '325', protein: '6.8', carbs: '70.5', fat: '0.8' })
    const eggs = setFoodPieces(foodDraftOf(food('egg'), 'Egg', 'e'), '3')
    expect(eggs).toMatchObject({ grams: '150', kcal: '215', fat: '14.3' })
    // back to grams keeps the weight; to pieces rounds to half pieces
    expect(setFoodByPiece(eggs, false)).toMatchObject({ grams: '150', pieces: '' })
    expect(setFoodByPiece(setFoodGrams(eggs, '130'), true)).toMatchObject({ pieces: '2.5', grams: '125' })
  })

  it('keeps numbers the coach typed over until reset', () => {
    const oats = setFoodMacro(foodDraftOf(food('oats'), 'Oats', 'o'), 'kcal', '400')
    expect(oats.manual).toBe(true)
    expect(setFoodGrams(oats, '50').kcal).toBe('400')
    const reset = resetFoodMacros(setFoodGrams(oats, '50'))
    expect(reset).toMatchObject({ manual: false, kcal: '190', protein: '6.6' })
  })

  it('adds up meals and the day, ignoring typed totals when there are foods', () => {
    const m1 = meal([setFoodGrams(foodDraftOf(food('greek-yogurt-2'), 'Yogurt', 'y'), '200'), foodDraftOf(food('banana'), 'Banana', 'b')])
    expect(mealDraftTotals({ ...m1, kcal: '999' })).toEqual({ kcal: 251, protein: 21.1, carbs: 32.9, fat: 4.4 })
    const m2 = { ...meal([]), kcal: '500', protein: '40' }
    expect(draftPlanTotals([m1, m2])).toEqual({ kcal: 751, protein: 61.1, carbs: 32.9, fat: 4.4 })
  })

  it('saves foods with derived meal totals and reads them back', () => {
    const custom = { ...customFoodDraft('Yiayia’s pie', 'p'), grams: '150', kcal: '420', protein: '12', carbs: '38', fat: '24' }
    const eggs = setFoodPieces(foodDraftOf(food('egg'), 'Egg', 'e'), '2')
    const d = { ...emptyDraft('2026-09-22'), title: 'T', meals: [{ ...meal([eggs, custom]), kcal: '1' }] }
    const p = planFromDraft(d, { id: 'n', memberId: 'm', createdBy: 'c', createdAt: 1 })
    const m = p.meals[0]
    expect(m.foods).toEqual([
      { id: 'e', name: 'Egg', grams: 100, kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, ref: 'egg', pieces: 2 },
      { id: 'p', name: 'Yiayia’s pie', grams: 150, kcal: 420, protein: 12, carbs: 38, fat: 24, ref: null },
    ])
    expect(m).toMatchObject({ kcal: 563, protein: 24.6, carbs: 38.7, fat: 33.5 })
    const back = draftFromPlan(p).meals[0].foods
    expect(back[0]).toMatchObject({ ref: 'egg', pieces: '2', manual: false })
    expect(back[1]).toMatchObject({ ref: null, manual: true })
    expect(planFromDraft(draftFromPlan(p), p).meals).toEqual(p.meals)
  })

  it('validates foods', () => {
    const bad = { ...customFoodDraft('', 'x'), grams: '99999', kcal: 'abc' }
    const d = { ...emptyDraft('2026-09-22'), title: 'T', meals: [{ ...meal([bad]), kcal: 'nonsense' }] }
    const e = validateDraft(d)
    expect(e.foods.x).toEqual({ name: 'required', grams: 'range', kcal: 'number' })
    // typed meal totals are not used (or checked) once the meal has foods
    expect(e.meals.m).toBeUndefined()
    expect(hasErrors(e)).toBe(true)
  })
})
