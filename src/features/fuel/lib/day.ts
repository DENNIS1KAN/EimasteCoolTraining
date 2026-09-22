import type { CheckinRating, Meal, MealPlan, NutritionCheckin } from '../../../data/types'
import { dailyId } from '../../../lib/ids'

/** "08:00" / "8:05" -> minutes after midnight; anything else -> null. */
export function mealMinutes(time: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h < 24 && min < 60 ? h * 60 + min : null
}

/** Minutes after midnight for a Date (local time). */
export const minutesOf = (d: Date): number => d.getHours() * 60 + d.getMinutes()

/**
 * The meal to eat next: the earliest un-ticked meal that is not more than `graceMin` overdue.
 * Plans without any meal times fall back to the first un-ticked meal in plan order.
 */
export function nextMealId(meals: Meal[], ticked: readonly string[], nowMin: number, graceMin = 60): string | null {
  const done = new Set(ticked)
  const open = meals.filter((m) => !done.has(m.id))
  if (!open.length) return null
  const timed = meals.some((m) => mealMinutes(m.time) != null)
  if (!timed) return open[0].id
  let best: { id: string; at: number } | null = null
  for (const m of open) {
    const at = mealMinutes(m.time)
    if (at == null || at < nowMin - graceMin) continue
    if (!best || at < best.at) best = { id: m.id, at }
  }
  return best?.id ?? null
}

export type MacroKey = 'protein' | 'carbs' | 'fat'
/** exact: summed from ticked meals; estimate: target scaled by the share of planned kcal eaten; target: no progress data. */
export type MacroMode = 'exact' | 'estimate' | 'target'

export interface MacroProgress {
  key: MacroKey
  target: number | null
  eaten: number | null
  mode: MacroMode
}

export interface DaySummary {
  mealsTotal: number
  mealsTicked: number
  /** Sum of the kcal of every meal that has one (null when no meal has kcal). */
  kcalPlanned: number | null
  /** kcal of the ticked meals (null when no meal has kcal). */
  kcalEaten: number | null
  /** The plan's kcal target, else the sum of its meals. */
  kcalTarget: number | null
  /** target - eaten (negative = over); null without both. */
  kcalLeft: number | null
  macros: MacroProgress[]
}

const sum = (xs: (number | null | undefined)[]): number => xs.reduce<number>((a, x) => a + (x ?? 0), 0)

export function daySummary(plan: MealPlan | null, ticked: readonly string[]): DaySummary {
  const meals = plan?.meals ?? []
  const done = new Set(ticked)
  const eatenMeals = meals.filter((m) => done.has(m.id))
  const hasKcal = meals.some((m) => m.kcal != null)
  const hasProtein = meals.some((m) => m.protein != null)
  const kcalPlanned = hasKcal ? sum(meals.map((m) => m.kcal)) : null
  const kcalEaten = hasKcal ? sum(eatenMeals.map((m) => m.kcal)) : null
  const kcalTarget = plan?.kcal ?? (kcalPlanned || null)
  const kcalLeft = kcalTarget != null && kcalEaten != null ? kcalTarget - kcalEaten : null
  const share = kcalPlanned && kcalEaten != null ? kcalEaten / kcalPlanned : null

  const protein: MacroProgress = hasProtein
    ? { key: 'protein', target: plan?.protein ?? sum(meals.map((m) => m.protein)), eaten: sum(eatenMeals.map((m) => m.protein)), mode: 'exact' }
    : estimated('protein', plan?.protein ?? null, share)
  return {
    mealsTotal: meals.length,
    mealsTicked: eatenMeals.length,
    kcalPlanned,
    kcalEaten,
    kcalTarget,
    kcalLeft,
    macros: [protein, estimated('carbs', plan?.carbs ?? null, share), estimated('fat', plan?.fat ?? null, share)],
  }
}

function estimated(key: MacroKey, target: number | null, share: number | null): MacroProgress {
  if (target == null) return { key, target: null, eaten: null, mode: 'target' }
  if (share == null) return { key, target, eaten: null, mode: 'target' }
  return { key, target, eaten: Math.round(target * share), mode: 'estimate' }
}

/** A fresh check-in row for a member's day. */
export function blankCheckin(memberId: string, date: string, planId: string | null): NutritionCheckin {
  return { id: dailyId(memberId, date), memberId, date, planId, meals: [], rating: null, waterL: null, note: '', updatedAt: 0 }
}

/** Tick / untick a meal; the check-in adopts the plan it was logged against. */
export function toggleMeal(c: NutritionCheckin, mealId: string, planId: string | null): NutritionCheckin {
  const has = c.meals.includes(mealId)
  return { ...c, planId: planId ?? c.planId, meals: has ? c.meals.filter((id) => id !== mealId) : [...c.meals, mealId] }
}

/** Selecting the current rating again clears it. */
export const nextRating = (cur: CheckinRating | null, picked: CheckinRating): CheckinRating | null => (cur === picked ? null : picked)

/** True when nothing meaningful is left in the row (so it can be deleted instead of stored empty). */
export const isBlankCheckin = (c: NutritionCheckin): boolean => !c.meals.length && c.rating == null && !c.waterL && !c.note.trim()
