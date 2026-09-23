import { describe, expect, it } from 'vitest'
import { displayFoodName, fold, FOODS, foodById, greeklish, macrosFor, searchFoods, unitLabel } from '.'

const ids = (q: string, lang: 'en' | 'el' = 'en') => searchFoods(q, lang).map((f) => f.id)

describe('food database', () => {
  it('has ~200 foods with unique ids, sane numbers and both names', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(150)
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length)
    for (const f of FOODS) {
      expect(f.en.trim() && f.el.trim(), f.id).toBeTruthy()
      expect(f.protein + f.carbs + f.fat, f.id).toBeLessThanOrEqual(100.5)
      // 4/4/9 within reason (alcohol has kcal of its own)
      if (!['beer', 'wine'].includes(f.id)) expect(Math.abs(f.protein * 4 + f.carbs * 4 + f.fat * 9 - f.kcal), f.id).toBeLessThan(Math.max(25, f.kcal * 0.12))
      if (f.unit) expect(f.unit.g).toBeGreaterThan(0)
    }
  })
})

describe('searchFoods', () => {
  it('finds foods in English and Greek, with or without accents', () => {
    expect(ids('greek yog')[0]).toBe('greek-yogurt-2')
    expect(ids('γιαούρτι')).toContain('greek-yogurt-2')
    expect(ids('γιαουρτι')).toContain('greek-yogurt-0')
    expect(ids('ΦΕΤΑ', 'el')[0]).toBe('feta')
    expect(ids('φέτα')).toContain('feta-light')
  })
  it('understands Greeklish', () => {
    expect(greeklish(fold('Κοτόπουλο'))).toContain('kotopoulo')
    expect(ids('kotopoulo')).toContain('chicken-breast-cooked')
    expect(ids('tiropita')).toContain('tiropita')
    expect(ids('giaourti')).toContain('greek-yogurt-2')
    expect(ids('tyropita')).toContain('tiropita')
    expect(ids('paximadi')[0]).toBe('rusk-barley')
  })
  it('ranks whole words and name starts first', () => {
    expect(ids('egg')[0]).toBe('egg')
    expect(ids('rice')[0]).toMatch(/^rice-/)
    expect(ids('chicken br')).toEqual(expect.arrayContaining(['chicken-breast-cooked', 'chicken-breast-raw']))
    expect(ids('ρυζι')).toContain('rice-white-cooked')
  })
  it('returns nothing for empty or unknown queries', () => {
    expect(ids('  ')).toEqual([])
    expect(ids('zzzqx')).toEqual([])
  })
})

describe('macro math', () => {
  it('scales per-100 g values to the portion', () => {
    const chicken = foodById('chicken-breast-cooked')!
    expect(macrosFor(chicken, 200)).toEqual({ kcal: 330, protein: 62, carbs: 0, fat: 7.2 })
    expect(macrosFor(chicken, 0)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
    expect(macrosFor(foodById('olive-oil')!, 13.5)).toEqual({ kcal: 119, protein: 0, carbs: 0, fat: 13.5 })
  })
  it('names foods in the viewer’s language unless the coach renamed them', () => {
    expect(displayFoodName({ name: 'Feta cheese', ref: 'feta' }, 'el')).toBe('Φέτα')
    expect(displayFoodName({ name: 'Feta from Epirus', ref: 'feta' }, 'el')).toBe('Feta from Epirus')
    expect(displayFoodName({ name: 'Yiayia’s pie', ref: null }, 'el')).toBe('Yiayia’s pie')
    expect(unitLabel('piece', 2, 'en')).toBe('pcs')
    expect(unitLabel('slice', 1, 'el')).toBe('φέτα')
  })
})
