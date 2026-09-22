import type { WeightEntry, WorkoutLog } from '../../../data/types'
import type { ISODate } from '../../../lib/dates'
import { addDays, dateRange, fromISODate, startOfWeek } from '../../../lib/dates'
import {
  bestE1rmByExercise,
  exerciseHistory,
  logDate,
  performedExercises,
  sessionSummary,
  weightSeries,
  weightStats,
  type H2HRow,
  type MetricKey,
  type ProgramMap,
  type TrendPoint,
} from '../../../lib/stats'

export interface XY {
  x: number
  y: number
}

const dayMs = (d: ISODate): number => fromISODate(d).getTime()

/* ------------------------------------------------------------------ the race */

/**
 * First day of the race: the earlier program start of the two, else the first finished workout of either.
 * Null when nothing has happened yet (or everything starts in the future).
 */
export function raceStart(starts: (ISODate | null | undefined)[], logs: WorkoutLog[], today: ISODate): ISODate | null {
  const candidates = starts.filter((s): s is ISODate => !!s && s <= today)
  const firstDone = logs
    .filter((l) => l.done)
    .map(logDate)
    .filter((d) => d <= today)
    .sort()[0]
  if (firstDone) candidates.push(firstDone)
  return candidates.sort()[0] ?? null
}

/** Finished workouts, cumulative, one point per day from `from` to `today` (x = local noon ms). */
export function raceSeries(logs: WorkoutLog[], from: ISODate, today: ISODate): XY[] {
  if (from > today) return []
  const perDay = new Map<ISODate, number>()
  let before = 0
  for (const l of logs) {
    if (!l.done) continue
    const d = logDate(l)
    if (d < from) before++
    else if (d <= today) perDay.set(d, (perDay.get(d) ?? 0) + 1)
  }
  let n = before
  return dateRange(from, today).map((d) => {
    n += perDay.get(d) ?? 0
    return { x: dayMs(d), y: n }
  })
}

/* ------------------------------------------------------------------ weekly volume */

/** Monday of each of the last `weeks` calendar weeks, oldest first (the current week last). */
export function lastWeeks(today: ISODate, weeks = 6): ISODate[] {
  const cur = startOfWeek(today)
  return Array.from({ length: weeks }, (_, i) => addDays(cur, (i - weeks + 1) * 7))
}

/** Training volume (kg) of finished workouts per calendar week, aligned with `weekStarts`. */
export function weeklyVolume(logs: WorkoutLog[], programs: ProgramMap, weekStarts: ISODate[]): number[] {
  const idx = new Map(weekStarts.map((w, i) => [w, i]))
  const out = weekStarts.map(() => 0)
  for (const l of logs) {
    if (!l.done) continue
    const i = idx.get(startOfWeek(logDate(l)))
    if (i == null) continue
    out[i] += sessionSummary(l, programs[l.programId]).volumeKg
  }
  return out
}

/* ------------------------------------------------------------------ lift duel */

/** Exercises both members performed, the ones they trained most (together) first. */
export function commonExercises(logsA: WorkoutLog[], logsB: WorkoutLog[], programs: ProgramMap): string[] {
  const count = (logs: WorkoutLog[]) => {
    const m = new Map<string, number>()
    for (const l of logs) for (const pe of performedExercises(l, programs[l.programId])) if (pe.bestE1rmKg > 0) m.set(pe.name, (m.get(pe.name) ?? 0) + 1)
    return m
  }
  const a = count(logsA)
  const b = count(logsB)
  return [...a.keys()]
    .filter((n) => b.has(n))
    .sort((x, y) => a.get(y)! + b.get(y)! - (a.get(x)! + b.get(x)!) || x.localeCompare(y))
}

/** Trend body weight on a date: the last trend point on or before it, else the first one after. */
export function bodyWeightOn(series: TrendPoint[], date: ISODate): number | null {
  if (!series.length) return null
  let found: TrendPoint | null = null
  for (const p of series) {
    if (p.date <= date) found = p
    else break
  }
  return (found ?? series[0]).trendKg
}

/**
 * Best estimated 1RM per training day for one exercise (x = local noon ms). With `bodyWeight`, the value is
 * relative to body weight on that day (e.g. 1.25 = 1.25 × body weight); days without a weight are dropped.
 */
export function liftDuelPoints(logs: WorkoutLog[], programs: ProgramMap, exercise: string, bodyWeight?: TrendPoint[]): XY[] {
  const perDay = new Map<ISODate, number>()
  for (const p of exerciseHistory(logs, programs, exercise)) {
    if (!(p.bestE1rmKg > 0)) continue
    perDay.set(p.date, Math.max(perDay.get(p.date) ?? 0, p.bestE1rmKg))
  }
  const out: XY[] = []
  for (const [date, kg] of [...perDay.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    if (bodyWeight) {
      const bw = bodyWeightOn(bodyWeight, date)
      if (!bw) continue
      out.push({ x: dayMs(date), y: kg / bw })
    } else out.push({ x: dayMs(date), y: kg })
  }
  return out
}

/* ------------------------------------------------------------------ weight change */

/** Trend weight change since the program start (or the first weigh-in) as a ratio, one point per weigh-in. */
export function weightChangeSeries(entries: WeightEntry[], since: ISODate | null): XY[] {
  const stats = weightStats(entries, since)
  if (!stats) return []
  return weightSeries(entries)
    .filter((p) => p.date >= stats.startDate)
    .map((p) => ({ x: dayMs(p.date), y: (p.trendKg - stats.startKg) / stats.startKg }))
}

/* ------------------------------------------------------------------ summary line */

export type Region = 'legs' | 'push' | 'pull'

/** Rough body region of an exercise from its name (English program names), null when unclear (e.g. core). */
export function exerciseRegion(name: string): Region | null {
  const n = name.toLowerCase()
  if (/(squat|leg|lunge|calf|calves|hamstring|glute|hip thrust|rdl|romanian|deadlift|step-up|split|adduct|abduct|quad)/.test(n)) return 'legs'
  if (/(\brows?\b|pulldown|pull-down|pull-up|pullup|\bchin|curl|face pull|shrug|\blats?\b|pullover|rear delt|reverse fly)/.test(n)) return 'pull'
  if (/(bench|press|dip|fly|flye|push|tricep|pushdown|extension|lateral raise|front raise|crossover|skull)/.test(n)) return 'push'
  return null
}

export interface RegionTally {
  region: Region
  a: number
  b: number
}

/** Per region, on how many shared exercises each side has the higher best e1RM. */
export function liftTallies(logsA: WorkoutLog[], logsB: WorkoutLog[], programs: ProgramMap): RegionTally[] {
  const bestA = bestE1rmByExercise(logsA, programs)
  const bestB = bestE1rmByExercise(logsB, programs)
  const tally = new Map<Region, RegionTally>()
  for (const [name, a] of bestA) {
    const b = bestB.get(name)
    const region = exerciseRegion(name)
    if (!b || !region || !(a > 0)) continue
    const t = tally.get(region) ?? { region, a: 0, b: 0 }
    if (a > b * 1.005) t.a++
    else if (b > a * 1.005) t.b++
    tally.set(region, t)
  }
  return [...tally.values()]
}

export type ClauseKind = 'lifts' | 'consistency' | 'volume' | 'prs' | 'streak' | 'gains' | 'nutrition'
export interface Clause {
  kind: ClauseKind
  who: 'a' | 'b'
  region?: Region
}

const CLAUSE_OF: Partial<Record<MetricKey, ClauseKind>> = {
  consistency: 'consistency',
  volumeWeek: 'volume',
  prs: 'prs',
  streak: 'streak',
  strength: 'gains',
  nutrition: 'nutrition',
}
const ORDER: ClauseKind[] = ['lifts', 'consistency', 'volume', 'prs', 'gains', 'streak', 'nutrition']

/**
 * Up to two short facts for the summary line, one per side when both lead somewhere
 * ("Thanos out-lifts you on legs; you're more consistent"). The viewer's rival speaks first, so the line
 * ends on what the viewer does better.
 */
export function summaryClauses(rows: H2HRow[], tallies: RegionTally[], viewerSide: 'a' | 'b' | null): Clause[] {
  const bySide = (who: 'a' | 'b'): Clause[] => {
    const out: Clause[] = []
    const lifts = tallies
      .map((t) => ({ region: t.region, margin: who === 'a' ? t.a - t.b : t.b - t.a }))
      .filter((t) => t.margin > 0)
      .sort((x, y) => y.margin - x.margin)[0]
    if (lifts) out.push({ kind: 'lifts', who, region: lifts.region })
    for (const r of rows) {
      const kind = CLAUSE_OF[r.key]
      if (kind && r.winner === who) out.push({ kind, who })
    }
    return out.sort((x, y) => ORDER.indexOf(x.kind) - ORDER.indexOf(y.kind))
  }
  const first: 'a' | 'b' = viewerSide === 'a' ? 'b' : 'a'
  const second: 'a' | 'b' = first === 'a' ? 'b' : 'a'
  const f = bySide(first)
  const s = bySide(second)
  if (f.length && s.length) return [f[0], s[0]]
  return (f.length ? f : s).slice(0, 2)
}
