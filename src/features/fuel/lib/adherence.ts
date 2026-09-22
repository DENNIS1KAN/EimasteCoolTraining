import type { CheckinRating, MealPlan, NutritionCheckin } from '../../../data/types'
import { addDays, dateRange, startOfWeek, type ISODate } from '../../../lib/dates'
import { checkinPlan, checkinScore } from '../../../lib/stats'

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

/**
 * dayClosed and recentAdherence live in lib/stats, so the Fuel page, the coach's Nutrition tab, the squad glance and
 * compare all show the same number. Pass the plans map to recentAdherence: days logged under an earlier plan are
 * scored against that plan and keep counting after the coach issues a new one.
 */
export { dayClosed, recentAdherence } from '../../../lib/stats'

/** The member's most recent check-in date, or null. */
export function lastCheckinDate(checkins: NutritionCheckin[], memberId: string): ISODate | null {
  let best: ISODate | null = null
  for (const c of checkins) if (c.memberId === memberId && (best == null || c.date > best)) best = c.date
  return best
}

/** Without a plan: consecutive rated days scoring >= 0.8 (ending today, or yesterday while today is open). */
export function ratingStreak(checkins: NutritionCheckin[], today: ISODate): number {
  const byDate = new Map(checkins.map((c) => [c.date, c]))
  const good = (d: ISODate) => checkinScore(byDate.get(d), null) >= 0.8
  let d = good(today) ? today : addDays(today, -1)
  let n = 0
  while (good(d) && n < 3650) {
    n++
    d = addDays(d, -1)
  }
  return n
}

/** Without a plan: the average score of the logged days in the window (null when nothing is logged). */
export function loggedAverage(days: FuelDay[]): number | null {
  const logged = days.filter((d) => d.logged && d.value != null)
  return logged.length ? logged.reduce((a, d) => a + (d.value ?? 0), 0) / logged.length : null
}
