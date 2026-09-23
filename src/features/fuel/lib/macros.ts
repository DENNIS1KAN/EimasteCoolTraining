import type { Meal, MealFood } from '../../../data/types'
import type { Macros } from '../foods/types'

export type MacroField = 'kcal' | 'protein' | 'carbs' | 'fat'
export const MACRO_FIELDS: MacroField[] = ['kcal', 'protein', 'carbs', 'fat']

export const EMPTY_MACROS: Macros = { kcal: null, protein: null, carbs: null, fat: null }

const round = (f: MacroField, x: number) => (f === 'kcal' ? Math.round(x) : Math.round(x * 10) / 10)

/** Field-wise sum; a field stays null only when it is null everywhere (a partly filled column still adds up). */
export function sumMacros(list: readonly Partial<Macros>[]): Macros {
  const out: Macros = { ...EMPTY_MACROS }
  for (const f of MACRO_FIELDS) {
    let any = false
    let total = 0
    for (const m of list) {
      const v = m[f]
      if (v == null || !Number.isFinite(v)) continue
      any = true
      total += v
    }
    out[f] = any ? round(f, total) : null
  }
  return out
}

export const hasFoods = (m: Pick<Meal, 'foods'>): m is { foods: MealFood[] } => !!m.foods && m.foods.length > 0

/**
 * A meal's kcal and macros: the sum of its foods when it has a food list (the source of truth), otherwise the
 * totals typed for the meal (plans made before food lists had kcal and protein only).
 */
export function mealTotals(meal: Pick<Meal, 'foods' | 'kcal' | 'protein' | 'carbs' | 'fat'>): Macros {
  if (hasFoods(meal)) return sumMacros(meal.foods)
  return { kcal: meal.kcal ?? null, protein: meal.protein ?? null, carbs: meal.carbs ?? null, fat: meal.fat ?? null }
}

/** The whole day's plan: the sum of its meals. */
export const planTotals = (meals: readonly Meal[]): Macros => sumMacros(meals.map(mealTotals))

/** The meal with its stored totals re-derived from its foods (so readers that only know totals agree). */
export function withDerivedTotals<M extends Meal>(meal: M): M {
  if (!hasFoods(meal)) return meal
  const t = sumMacros(meal.foods)
  return { ...meal, kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat }
}

/** kcal implied by macros (4 / 4 / 9 kcal per gram); null when no macro is known. */
export function kcalOfMacros(m: Pick<Macros, 'protein' | 'carbs' | 'fat'>): number | null {
  if (m.protein == null && m.carbs == null && m.fat == null) return null
  return Math.round((m.protein ?? 0) * 4 + (m.carbs ?? 0) * 4 + (m.fat ?? 0) * 9)
}

export type TargetVerdict = 'on' | 'over' | 'under'

export interface TargetCheck {
  field: MacroField
  total: number | null
  target: number | null
  /** total - target (null without both). */
  diff: number | null
  verdict: TargetVerdict | null
}

/** Within ±5% of the target (and at least ±50 kcal / ±5 g) counts as on target. */
export function checkTarget(field: MacroField, total: number | null, target: number | null): TargetCheck {
  if (total == null || target == null) return { field, total, target, diff: null, verdict: null }
  const diff = round(field, total - target)
  const tolerance = Math.max(target * 0.05, field === 'kcal' ? 50 : 5)
  const verdict: TargetVerdict = Math.abs(diff) <= tolerance ? 'on' : diff > 0 ? 'over' : 'under'
  return { field, total, target, diff, verdict }
}
