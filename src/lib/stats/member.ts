import type { Cheer, MealPlan, Member, NutritionCheckin, Post, Program, WeightEntry, WorkoutLog } from '../../data/types'
import type { ISODate } from '../dates'
import { addDays, isoFromMs, startOfWeek } from '../dates'
import { totalWorkouts } from '../../data/programs'
import { checkinPlan, checkinScore, currentPlan, recentAdherence } from './nutrition'
import { goalProgress, weightStats, type WeightStats } from './body'
import { logTime, personalRecords, sessionSummary, strengthGain, type PR, type ProgramMap } from './lifts'
import { programWeekOn, scheduleStatus, upcomingWorkout, type ScheduleStatus, type WorkoutRef } from './schedule'

/** The slice of app state the stats need (structurally compatible with the store's TableState). */
export interface SquadData {
  members: Record<string, Member>
  programs: Record<string, Program>
  logs: Record<string, WorkoutLog>
  weights: Record<string, WeightEntry>
  mealPlans: Record<string, MealPlan>
  checkins: Record<string, NutritionCheckin>
  cheers: Record<string, Cheer>
  posts: Record<string, Post>
}

export const logsOf = (d: SquadData, memberId: string, programId?: string): WorkoutLog[] =>
  Object.values(d.logs).filter((l) => l.memberId === memberId && (!programId || l.programId === programId))
export const weightsOf = (d: SquadData, memberId: string): WeightEntry[] =>
  Object.values(d.weights).filter((w) => w.memberId === memberId)
export const plansOf = (d: SquadData, memberId: string): MealPlan[] => Object.values(d.mealPlans).filter((p) => p.memberId === memberId)
export const checkinsOf = (d: SquadData, memberId: string): NutritionCheckin[] =>
  Object.values(d.checkins).filter((c) => c.memberId === memberId)
export const programOf = (d: SquadData, m: Member | null | undefined): Program | null =>
  (m?.programId && d.programs[m.programId]) || null

/**
 * Whether the squad can read the member's weigh-ins (weight visibility other than 'private'). Weigh-ins earn
 * league points and weight badges only then: the database hides a private member's weigh-ins from squad
 * mates, so counting them would give different standings on different phones (the setting itself is on
 * every phone).
 */
export const sharesWeight = (m: Pick<Member, 'settings'> | null | undefined): boolean => m?.settings?.weightVisibility !== 'private'

/** Members sorted: athletes first (by name), then coach(es). */
export function sortedMembers(d: SquadData): Member[] {
  return Object.values(d.members).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'athlete' ? -1 : 1))
}
/** Members who take part in leaderboards and comparisons. */
export const competitors = (d: SquadData): Member[] => sortedMembers(d).filter((m) => m.competes)

/** Done workouts whose finish date falls within [from, to]. */
export function doneBetween(logs: WorkoutLog[], from: ISODate, to: ISODate): WorkoutLog[] {
  return logs.filter((l) => {
    if (!l.done) return false
    const d = isoFromMs(logTime(l))
    return d >= from && d <= to
  })
}

/**
 * Consecutive calendar weeks (Mon-Sun) with at least `minPerWeek` finished workouts, ending with the current
 * week if it already qualifies, otherwise with last week (the current week can still be saved).
 */
export function weekStreak(logs: WorkoutLog[], today: ISODate, minPerWeek = 3): number {
  const perWeek = new Map<ISODate, number>()
  for (const l of logs) if (l.done) {
    const w = startOfWeek(isoFromMs(logTime(l)))
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1)
  }
  let w = startOfWeek(today)
  if ((perWeek.get(w) ?? 0) < minPerWeek) w = addDays(w, -7)
  let n = 0
  while ((perWeek.get(w) ?? 0) >= minPerWeek) {
    n++
    w = addDays(w, -7)
  }
  return n
}

export interface MemberStats {
  memberId: string
  program: Program | null
  /** Calendar program week today (0 = not started). */
  programWeek: number
  workoutsDone: number
  workoutsTotal: number
  schedule: ScheduleStatus | null
  weekStreak: number
  thisWeek: { done: number; target: number }
  volumeWeekKg: number
  volumeTotalKg: number
  prs: PR[]
  prs30d: number
  strengthGainPct: number | null
  weight: WeightStats | null
  goalProgress: number | null
  /** The meal plan in force (active, else the latest); null without one. */
  mealPlan: MealPlan | null
  /**
   * Nutrition adherence over the last 14 days, today included once it is closed (see recentAdherence).
   * null without a meal plan or before the first complete day on a plan.
   */
  adherence14: number | null
  /** Days counted in adherence14 (0..14), e.g. to wait a few days before judging a new plan. */
  adherence14Days: number
  lastWorkoutAt: number | null
  nextWorkout: WorkoutRef | null
  points: Points
}

export function memberStats(d: SquadData, memberId: string, today: ISODate): MemberStats {
  const m = d.members[memberId]
  const program = programOf(d, m)
  const logs = logsOf(d, memberId)
  const programLogs = program ? logs.filter((l) => l.programId === program.id) : []
  const programs: ProgramMap = d.programs
  const weekStart = startOfWeek(today)
  const doneLogs = logs.filter((l) => l.done)
  const thisWeekLogs = doneBetween(logs, weekStart, addDays(weekStart, 6))
  const prs = personalRecords(logs, programs)
  const weights = weightsOf(d, memberId)
  const w = weightStats(weights, m?.programStart ?? null, today)
  const plan = currentPlan(plansOf(d, memberId), memberId)
  const adh = recentAdherence(checkinsOf(d, memberId), plan, today, 14, d.mealPlans)
  const perWeekTarget = program ? program.schedule.filter((s) => s != null).length || program.weeks[0]?.days.length || 5 : 5
  return {
    memberId,
    program,
    programWeek: program && m?.programStart ? programWeekOn(program, m.programStart, today) : 0,
    workoutsDone: programLogs.filter((l) => l.done).length,
    workoutsTotal: program ? totalWorkouts(program) : 0,
    schedule: program ? scheduleStatus(program, m?.programStart ?? null, programLogs, today) : null,
    weekStreak: weekStreak(logs, today),
    thisWeek: { done: thisWeekLogs.length, target: perWeekTarget },
    volumeWeekKg: thisWeekLogs.reduce((a, l) => a + sessionSummary(l, programs[l.programId]).volumeKg, 0),
    volumeTotalKg: doneLogs.reduce((a, l) => a + sessionSummary(l, programs[l.programId]).volumeKg, 0),
    prs,
    prs30d: prs.filter((p) => p.date > addDays(today, -30)).length,
    strengthGainPct: strengthGain(logs, programs)?.pct ?? null,
    weight: w,
    goalProgress: w ? goalProgress(w.startKg, w.trendKg, m?.goalWeightKg ?? null) : null,
    mealPlan: plan,
    adherence14: adh && adh.days ? adh.ratio : null,
    adherence14Days: adh?.days ?? 0,
    lastWorkoutAt: doneLogs.length ? Math.max(...doneLogs.map(logTime)) : null,
    nextWorkout: program ? upcomingWorkout(program, m?.programStart ?? null, programLogs, today) : null,
    points: points(d, memberId, weekStart, addDays(weekStart, 6)),
  }
}

/* ------------------------------------------------------------------ squad league points */

export const POINTS = { workout: 10, pr: 5, perfectWeek: 15, weighIn: 1, onPlanDay: 2 } as const

export interface Points {
  total: number
  workouts: number
  prs: number
  perfectWeeks: number
  weighIns: number
  onPlanDays: number
}

/**
 * League points earned within [from, to] (inclusive; omit for all time):
 * workout 10, PR 5, perfect program week 15 (all its workouts done, counted in the week the last one was finished),
 * weigh-in 1 per day (only while the weight is shared with the squad, see sharesWeight), nutrition day on
 * plan (score >= 0.8) 2.
 */
export function points(d: SquadData, memberId: string, from?: ISODate, to?: ISODate): Points {
  const inRange = (date: ISODate) => (!from || date >= from) && (!to || date <= to)
  const logs = logsOf(d, memberId)
  const done = logs.filter((l) => l.done && inRange(isoFromMs(logTime(l))))
  const prs = personalRecords(logs, d.programs).filter((p) => inRange(p.date))
  // perfect program weeks
  let perfect = 0
  const byWeek = new Map<string, WorkoutLog[]>()
  for (const l of logs) if (l.done) {
    const k = `${l.programId}#${l.week}`
    byWeek.set(k, [...(byWeek.get(k) ?? []), l])
  }
  for (const [k, ls] of byWeek) {
    const [pid, wk] = k.split('#')
    const days = d.programs[pid]?.weeks[Number(wk) - 1]?.days.length ?? 0
    if (days && ls.length >= days) {
      const last = Math.max(...ls.map(logTime))
      if (inRange(isoFromMs(last))) perfect++
    }
  }
  const weighIns = sharesWeight(d.members[memberId]) ? new Set(weightsOf(d, memberId).map((w) => w.date).filter(inRange)).size : 0
  const plan = currentPlan(plansOf(d, memberId), memberId)
  const onPlan = checkinsOf(d, memberId).filter((c) => inRange(c.date) && checkinScore(c, checkinPlan(c, d.mealPlans, plan)) >= 0.8).length
  const p = {
    workouts: done.length * POINTS.workout,
    prs: prs.length * POINTS.pr,
    perfectWeeks: perfect * POINTS.perfectWeek,
    weighIns: weighIns * POINTS.weighIn,
    onPlanDays: onPlan * POINTS.onPlanDay,
  }
  return { ...p, total: p.workouts + p.prs + p.perfectWeeks + p.weighIns + p.onPlanDays }
}

/* ------------------------------------------------------------------ head to head */

export type MetricKey = 'points' | 'workouts' | 'consistency' | 'streak' | 'volumeWeek' | 'prs' | 'strength' | 'goal' | 'nutrition'

export interface H2HRow {
  key: MetricKey
  a: number | null
  b: number | null
  /** null when the metric can't be compared (missing on one side). */
  winner: 'a' | 'b' | 'tie' | null
}

export function metricValue(s: MemberStats, key: MetricKey): number | null {
  switch (key) {
    case 'points':
      return s.points.total
    case 'workouts':
      return s.workoutsDone
    case 'consistency':
      return s.schedule?.consistency ?? null
    case 'streak':
      return s.weekStreak
    case 'volumeWeek':
      return s.volumeWeekKg
    case 'prs':
      return s.prs.length
    case 'strength':
      return s.strengthGainPct
    case 'goal':
      return s.goalProgress
    case 'nutrition':
      return s.adherence14
  }
}

export const H2H_METRICS: MetricKey[] = ['points', 'workouts', 'consistency', 'streak', 'volumeWeek', 'prs', 'strength', 'goal', 'nutrition']

/** Compare two members metric by metric (all metrics: higher is better). */
export function headToHead(a: MemberStats, b: MemberStats, keys: MetricKey[] = H2H_METRICS): { rows: H2HRow[]; a: number; b: number } {
  const rows = keys.map((key) => {
    const va = metricValue(a, key)
    const vb = metricValue(b, key)
    let winner: H2HRow['winner'] = null
    if (va != null && vb != null) {
      const eps = key === 'consistency' || key === 'strength' || key === 'goal' || key === 'nutrition' ? 0.005 : 0.0001
      winner = Math.abs(va - vb) <= eps ? 'tie' : va > vb ? 'a' : 'b'
    }
    return { key, a: va, b: vb, winner }
  })
  return { rows, a: rows.filter((r) => r.winner === 'a').length, b: rows.filter((r) => r.winner === 'b').length }
}

/** Ranking for one metric, best first; members without a value go last. */
export function rankBy(stats: MemberStats[], key: MetricKey): { memberId: string; value: number | null; rank: number }[] {
  const sorted = [...stats].sort((x, y) => (metricValue(y, key) ?? -Infinity) - (metricValue(x, key) ?? -Infinity))
  let rank = 0
  let prev: number | null | undefined
  return sorted.map((s, i) => {
    const v = metricValue(s, key)
    if (v !== prev) rank = i + 1
    prev = v
    return { memberId: s.memberId, value: v, rank }
  })
}
