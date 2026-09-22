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

export interface Adherence {
  days: number
  logged: number
  /** Average daily score 0..1, missing days count as 0. */
  ratio: number
  byDay: { date: ISODate; score: number; logged: boolean }[]
}

/** Adherence over [from, to], counting only days since the plan started. null without a plan. */
export function adherence(checkins: NutritionCheckin[], plan: MealPlan | null, from: ISODate, to: ISODate): Adherence | null {
  if (!plan) return null
  const start = maxDate(from, plan.startDate)
  if (start > to) return { days: 0, logged: 0, ratio: 0, byDay: [] }
  const byDate = new Map(checkins.filter((c) => c.memberId === plan.memberId).map((c) => [c.date, c]))
  const byDay = dateRange(start, to).map((date) => {
    const c = byDate.get(date)
    return { date, score: checkinScore(c, plan), logged: !!c }
  })
  const days = byDay.length
  return {
    days,
    logged: byDay.filter((d) => d.logged).length,
    ratio: days ? byDay.reduce((a, d) => a + d.score, 0) / days : 0,
    byDay,
  }
}

/** Consecutive days (ending today, or yesterday if today isn't logged yet) scoring >= 0.8. */
export function onPlanStreak(checkins: NutritionCheckin[], plan: MealPlan | null, today: ISODate): number {
  if (!plan) return 0
  const byDate = new Map(checkins.filter((c) => c.memberId === plan.memberId).map((c) => [c.date, c]))
  const good = (d: ISODate) => checkinScore(byDate.get(d), plan) >= 0.8
  let n = 0
  let d = today
  if (!good(d)) d = addDays(d, -1)
  while (good(d) && d >= plan.startDate) {
    n++
    d = addDays(d, -1)
  }
  return n
}

