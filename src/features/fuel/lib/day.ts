import type { CheckinRating, Meal, MealPlan, NutritionCheckin } from '../../../data/types'
import { dailyId } from '../../../lib/ids'
import { mealTotals, type MacroField } from './macros'

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

const sum = (xs: (number | null | undefined)[]): number => Math.round(xs.reduce<number>((a, x) => a + (x ?? 0), 0) * 10) / 10

export function daySummary(plan: MealPlan | null, ticked: readonly string[]): DaySummary {
  const meals = plan?.meals ?? []
  const done = new Set(ticked)
  const totals = meals.map(mealTotals)
  const eaten = totals.filter((_, i) => done.has(meals[i].id))
  const has = (f: MacroField) => totals.some((t) => t[f] != null)
  const kcalPlanned = has('kcal') ? sum(totals.map((t) => t.kcal)) : null
  const kcalEaten = has('kcal') ? sum(eaten.map((t) => t.kcal)) : null
  const kcalTarget = plan?.kcal ?? (kcalPlanned || null)
  const kcalLeft = kcalTarget != null && kcalEaten != null ? kcalTarget - kcalEaten : null
  const share = kcalPlanned && kcalEaten != null ? kcalEaten / kcalPlanned : null

  // Real numbers wherever the meals carry the macro (food lists always do); otherwise an estimate from kcal.
  const macro = (key: MacroKey): MacroProgress =>
    has(key)
      ? { key, target: plan?.[key] ?? sum(totals.map((t) => t[key])), eaten: sum(eaten.map((t) => t[key])), mode: 'exact' }
      : estimated(key, plan?.[key] ?? null, share)
  return {
    mealsTotal: meals.length,
    mealsTicked: eaten.length,
    kcalPlanned,
    kcalEaten,
    kcalTarget,
    kcalLeft,
    macros: [macro('protein'), macro('carbs'), macro('fat')],
  }
}

function estimated(key: MacroKey, target: number | null, share: number | null): MacroProgress {
  if (target == null) return { key, target: null, eaten: null, mode: 'target' }
  if (share == null) return { key, target, eaten: null, mode: 'target' }
  return { key, target, eaten: Math.round(target * share), mode: 'estimate' }
}

/** A fresh check-in row for a member's day. */
export function blankCheckin(memberId: string, date: string, planId: string | null): NutritionCheckin {
  return { id: dailyId(memberId, date), memberId, date, planId, meals: [], rating: null, note: '', updatedAt: 0 }
}

/** Tick / untick a meal; the check-in adopts the plan it was logged against. */
export function toggleMeal(c: NutritionCheckin, mealId: string, planId: string | null): NutritionCheckin {
  const has = c.meals.includes(mealId)
  return { ...c, planId: planId ?? c.planId, meals: has ? c.meals.filter((id) => id !== mealId) : [...c.meals, mealId] }
}

/** Selecting the current rating again clears it. */
export const nextRating = (cur: CheckinRating | null, picked: CheckinRating): CheckinRating | null => (cur === picked ? null : picked)

/** True when nothing meaningful is left in the row (so it can be deleted instead of stored empty). */
export const isBlankCheckin = (c: NutritionCheckin): boolean => !c.meals.length && c.rating == null && !c.note.trim()

/**
 * The plan that applies on a date. Today follows the current plan as soon as it has started, even when today's
 * check-in was logged against the plan it replaced: a plan the coach issues mid-day takes over at once (its card,
 * meals and targets agree). Other days show the plan their check-in was logged against (history stays as it was
 * lived), else the newest plan already started by then, else the current plan (so a day before any plan still
 * shows something to follow).
 */
export function planOnDate(
  plans: MealPlan[],
  current: MealPlan | null,
  date: string,
  checkin?: NutritionCheckin | null,
  today?: string,
): MealPlan | null {
  if (date === today && current && current.startDate <= date) return current
  if (checkin?.planId) {
    const own = plans.find((p) => p.id === checkin.planId)
    if (own) return own
  }
  if (current && current.startDate <= date) return current
  const started = plans.filter((p) => p.startDate <= date).sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0))
  return started[0] ?? current
}

const mealKey = (s: string) => s.trim().toLocaleLowerCase()

/**
 * Ticks logged against `from` carried over to `to`: kept when the meal id exists in `to` (a plan edited in place),
 * otherwise matched by meal name, then by a unique time (a copied plan gets fresh meal ids). The rest are dropped.
 */
export function carryTicks(ticked: readonly string[], from: MealPlan | null, to: MealPlan): string[] {
  const ids = new Set(to.meals.map((m) => m.id))
  const out = new Set<string>()
  for (const id of ticked) {
    if (ids.has(id)) {
      out.add(id)
      continue
    }
    const old = from?.meals.find((m) => m.id === id)
    if (!old) continue
    const byName = old.name.trim() ? to.meals.find((m) => mealKey(m.name) === mealKey(old.name)) : undefined
    const sameTime = old.time.trim() ? to.meals.filter((m) => m.time.trim() === old.time.trim()) : []
    const match = byName ?? (sameTime.length === 1 ? sameTime[0] : undefined)
    if (match) out.add(match.id)
  }
  return to.meals.filter((m) => out.has(m.id)).map((m) => m.id)
}

/** The day's ticks in terms of `plan` (the plan shown for the day), carrying them over from the check-in's own plan. */
export function ticksFor(checkin: NutritionCheckin | null | undefined, plan: MealPlan | null, plans: MealPlan[]): string[] {
  if (!checkin) return []
  if (!plan || !checkin.planId || checkin.planId === plan.id) return checkin.meals
  return carryTicks(checkin.meals, plans.find((p) => p.id === checkin.planId) ?? null, plan)
}

/** Moves a check-in onto the plan shown for its day (on the first change after a new plan took over). */
export function adoptPlan(c: NutritionCheckin, plan: MealPlan | null, plans: MealPlan[]): NutritionCheckin {
  if (!plan || !c.planId || c.planId === plan.id) return c
  return { ...c, planId: plan.id, meals: ticksFor(c, plan, plans) }
}
