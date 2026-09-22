import { describe, expect, it } from 'vitest'
import type { MealPlan } from '../../../data/types'
import {
  bumpTitle,
  draftFromPlan,
  draftMacroKcal,
  draftMealsKcal,
  duplicateDraft,
  emptyDraft,
  hasErrors,
  kcalFromMacros,
  moveItem,
  othersToDeactivate,
  planFromDraft,
  validateDraft,
} from './draft'

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
  meals: [{ id: 'a', name: 'Breakfast', time: '08:00', items: 'Oats\nWhey', kcal: 600, protein: 40 }],
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
      meals: [{ id: 'm1', name: ' Lunch ', time: '9:30', items: ' rice \n\n chicken ', kcal: '', protein: '45' }],
    }
    const p = planFromDraft(d, { id: 'n', memberId: 'm', createdBy: 'c', createdAt: 1 })
    expect(p.title).toBe('Bulk')
    expect(p.waterL).toBe(2.5)
    expect(p.kcal).toBeNull()
    expect(p.meals[0]).toEqual({ id: 'm1', name: 'Lunch', time: '09:30', items: 'rice\nchicken', kcal: null, protein: 45 })
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
    const d = duplicateDraft(base, '2026-09-22', () => `new-${++n}`)
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
