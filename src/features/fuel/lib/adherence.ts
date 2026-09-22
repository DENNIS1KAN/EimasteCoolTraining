import type { CheckinRating, MealPlan, NutritionCheckin } from '../../../data/types'
import { addDays, dateRange, startOfWeek, type ISODate } from '../../../lib/dates'
import { adherence, checkinPlan, checkinScore, type Adherence } from '../../../lib/stats'

/** One calendar day of the nutrition heatmap. */
export interface FuelDay {
  date: ISODate
  /** 0..1 score; null = nothing to show (future, or before the first plan and not logged). */
  value: number | null
  logged: boolean
  /** Meals ticked out of the plan's meals (0 / 0 without a plan). */
  ticked: number
  total: number
  rating: CheckinRating | null
}

/** Days of the heatmap: whole Monday-Sunday weeks, the last one containing `today`. */
export function heatRange(today: ISODate, weeks: number): { from: ISODate; to: ISODate } {
  const lastMonday = startOfWeek(today)
  return { from: addDays(lastMonday, -7 * (weeks - 1)), to: addDays(lastMonday, 6) }
}

/**
 * Per-day scores for one member. Past check-ins are scored against the plan they were logged with,
 * so a new plan does not rewrite history. Unlogged days since the first plan count as 0.
 */
export function fuelDays(
  checkins: NutritionCheckin[],
  plans: Record<string, MealPlan>,
  current: MealPlan | null,
  from: ISODate,
  to: ISODate,
  today: ISODate,
): FuelDay[] {
  const byDate = new Map(checkins.map((c) => [c.date, c]))
  const memberId = current?.memberId ?? checkins[0]?.memberId
  const starts = Object.values(plans)
    .filter((p) => p.memberId === memberId)
    .map((p) => p.startDate)
    .sort()
  const firstStart = starts[0] ?? null
  return dateRange(from, to).map((date) => {
    const c = byDate.get(date)
    if (date > today) return { date, value: null, logged: false, ticked: 0, total: 0, rating: null }
    if (!c) {
      const counts = firstStart != null && date >= firstStart
      return { date, value: counts ? 0 : null, logged: false, ticked: 0, total: 0, rating: null }
    }
    const plan = checkinPlan(c, plans, current)
    const ids = new Set(plan?.meals.map((m) => m.id) ?? [])
    return {
      date,
      value: checkinScore(c, plan),
      logged: true,
      ticked: c.meals.filter((id) => ids.has(id)).length,
      total: ids.size,
      rating: c.rating,
    }
  })
}

/** A day is closed once it has a rating or every planned meal is ticked. */
export function dayClosed(c: NutritionCheckin | undefined, plan: MealPlan | null): boolean {
  if (!c) return false
  if (c.rating) return true
  return !!plan && plan.meals.length > 0 && plan.meals.every((m) => c.meals.includes(m.id))
}

/**
 * Adherence over the last `days` days. Today only counts once it is closed, so a morning with two meals
 * ticked does not drag the number down. A plan that starts today reports today alone.
 */
export function recentAdherence(checkins: NutritionCheckin[], plan: MealPlan | null, today: ISODate, days: number): Adherence | null {
  if (!plan) return null
  const mine = checkins.filter((c) => c.memberId === plan.memberId)
  const todayRow = mine.find((c) => c.date === today)
  const end = dayClosed(todayRow, plan) ? today : addDays(today, -1)
  const a = adherence(mine, plan, addDays(end, -(days - 1)), end)
  if (a && a.days > 0) return a
  return adherence(mine, plan, today, today)
}

/** The member's most recent check-in date, or null. */
export function lastCheckinDate(checkins: NutritionCheckin[], memberId: string): ISODate | null {
  let best: ISODate | null = null
  for (const c of checkins) if (c.memberId === memberId && (best == null || c.date > best)) best = c.date
  return best
}
