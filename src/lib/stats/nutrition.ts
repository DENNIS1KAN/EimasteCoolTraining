import type { MealPlan, NutritionCheckin } from '../../data/types'
import type { ISODate } from '../dates'
import { addDays, dateRange, maxDate } from '../dates'

/** The plan in force for a member: the active one, else the most recent by start date. */
export function currentPlan(plans: MealPlan[], memberId: string): MealPlan | null {
  const mine = plans.filter((p) => p.memberId === memberId)
  return mine.find((p) => p.active) ?? mine.sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0] ?? null
}

/**
 * 0..1 for one day: fraction of the plan's meals ticked; otherwise (nothing ticked, a plan without meals, or
 * ticks that all belong to another plan) the overall rating (on 1 / mostly 0.5 / off 0).
 */
export function checkinScore(c: NutritionCheckin | undefined, plan: MealPlan | null): number {
  if (!c) return 0
  const planned = new Set(plan?.meals.map((m) => m.id) ?? [])
  const ticked = new Set(c.meals.filter((id) => planned.has(id)))
  if (ticked.size > 0) return Math.min(1, ticked.size / planned.size)
  return c.rating === 'on' ? 1 : c.rating === 'mostly' ? 0.5 : 0
}

/**
 * The plan a check-in was logged against, else `fallback` (usually the current plan). Scoring past days
 * against their own plan keeps them stable when the coach issues a new plan with new meal ids.
 */
export function checkinPlan(c: NutritionCheckin, plans: Record<string, MealPlan>, fallback: MealPlan | null): MealPlan | null {
  const own = c.planId ? plans[c.planId] : undefined
  return own && own.memberId === c.memberId ? own : fallback
}

/**
 * The first day any of the member's plans was in force: their nutrition history starts here, so issuing a
 * new plan does not restart it. Without `plans` it is the given plan's start.
 */
export function firstPlanStart(plan: MealPlan, plans?: Record<string, MealPlan>): ISODate {
  let first = plan.startDate
  if (plans) for (const p of Object.values(plans)) if (p.memberId === plan.memberId && p.startDate < first) first = p.startDate
  return first
}

/** One day's score, against the plan the check-in was logged with (else `current`). 0 when not logged. */
function dayScore(c: NutritionCheckin | undefined, plans: Record<string, MealPlan> | undefined, current: MealPlan): number {
  return c ? checkinScore(c, checkinPlan(c, plans ?? {}, current)) : 0
}

export interface Adherence {
  days: number
  logged: number
  /** Average daily score 0..1, missing days count as 0. */
  ratio: number
  byDay: { date: ISODate; score: number; logged: boolean }[]
}

/**
 * Adherence over [from, to], counting only days since the member's first plan started. null without a plan.
 * Pass the plans map (`mealPlans`) so days logged under an earlier plan are scored against that plan and
 * count toward the window; without it only days since `plan` started count, scored against `plan`.
 */
export function adherence(
  checkins: NutritionCheckin[],
  plan: MealPlan | null,
  from: ISODate,
  to: ISODate,
  plans?: Record<string, MealPlan>,
): Adherence | null {
  if (!plan) return null
  const start = maxDate(from, firstPlanStart(plan, plans))
  if (start > to) return { days: 0, logged: 0, ratio: 0, byDay: [] }
  const byDate = new Map(checkins.filter((c) => c.memberId === plan.memberId).map((c) => [c.date, c]))
  const byDay = dateRange(start, to).map((date) => {
    const c = byDate.get(date)
    return { date, score: dayScore(c, plans, plan), logged: !!c }
  })
  const days = byDay.length
  return {
    days,
    logged: byDay.filter((d) => d.logged).length,
    ratio: days ? byDay.reduce((a, d) => a + d.score, 0) / days : 0,
    byDay,
  }
}

/** A day is closed once it has a rating or every meal of its plan is ticked. */
export function dayClosed(c: NutritionCheckin | undefined, plan: MealPlan | null): boolean {
  if (!c) return false
  if (c.rating) return true
  return !!plan && plan.meals.length > 0 && plan.meals.every((m) => c.meals.includes(m.id))
}

/**
 * Adherence over the last `days` days: the one number every screen shows ("14-day adherence").
 * Today only counts once it is closed, so a morning with two meals ticked does not drag the number down.
 * `days` is 0 (callers show no number) until the first complete day since the member's first plan.
 */
export function recentAdherence(
  checkins: NutritionCheckin[],
  plan: MealPlan | null,
  today: ISODate,
  days: number,
  plans?: Record<string, MealPlan>,
): Adherence | null {
  if (!plan) return null
  const mine = checkins.filter((c) => c.memberId === plan.memberId)
  const todayRow = mine.find((c) => c.date === today)
  const end = todayRow && dayClosed(todayRow, checkinPlan(todayRow, plans ?? {}, plan)) ? today : addDays(today, -1)
  return adherence(mine, plan, addDays(end, -(days - 1)), end, plans)
}

/**
 * Consecutive days (ending today, or yesterday if today isn't good yet) scoring >= 0.8, since the member's
 * first plan. Pass the plans map so days logged under an earlier plan keep counting after a plan change.
 */
export function onPlanStreak(checkins: NutritionCheckin[], plan: MealPlan | null, today: ISODate, plans?: Record<string, MealPlan>): number {
  if (!plan) return 0
  const first = firstPlanStart(plan, plans)
  const byDate = new Map(checkins.filter((c) => c.memberId === plan.memberId).map((c) => [c.date, c]))
  const good = (d: ISODate) => dayScore(byDate.get(d), plans, plan) >= 0.8
  let n = 0
  let d = good(today) ? today : addDays(today, -1)
  while (d >= first && good(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}
