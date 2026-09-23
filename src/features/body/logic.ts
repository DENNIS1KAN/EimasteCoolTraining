/**
 * Pure helpers behind the Body screen: phases, tones, goal progress, chart ranges, history rows and
 * who may see whose weight. Everything works in kg; the UI converts to the viewer's unit at the edges.
 */
import type { Member, Unit, WeightEntry } from '../../data/types'
import { addDays, diffDays, type ISODate } from '../../lib/dates'
import { weightSeries, weightStats, type TrendPoint } from '../../lib/stats'
import { kgToUnit, parseNum, unitToKg } from '../../lib/units'

/* ------------------------------------------------------------------ phase and tone */

export type Phase = 'cut' | 'bulk' | 'maintain'
export type Dir = 'up' | 'down' | 'flat'
export type Tone = 'good' | 'warn' | 'neutral'

/** A goal within this distance of the start weight means "hold steady". */
export const MAINTAIN_BAND_KG = 1

/** Cut / bulk / maintain from the start weight and the goal; null without a goal or a start. */
export function phaseOf(startKg: number | null | undefined, goalKg: number | null | undefined): Phase | null {
  if (goalKg == null || !Number.isFinite(goalKg) || startKg == null || !Number.isFinite(startKg)) return null
  const d = goalKg - startKg
  if (Math.abs(d) < MAINTAIN_BAND_KG) return 'maintain'
  return d < 0 ? 'cut' : 'bulk'
}

/** Direction of a change; anything under 0.05 kg is flat (it rounds to 0.0 on screen). */
export function dirOf(deltaKg: number, eps = 0.05): Dir {
  if (!Number.isFinite(deltaKg) || Math.abs(deltaKg) < eps) return 'flat'
  return deltaKg < 0 ? 'down' : 'up'
}

/**
 * Good when the change moves toward the goal, warn when it moves away, neutral without a goal.
 * When maintaining, staying inside the band is good (pass `band: null` for day-to-day noise, which is neutral).
 */
export function toneOf(deltaKg: number, phase: Phase | null, band: number | null = MAINTAIN_BAND_KG): Tone {
  const dir = dirOf(deltaKg)
  if (!phase) return 'neutral'
  if (phase === 'maintain') {
    if (band == null) return 'neutral'
    return Math.abs(deltaKg) <= band ? 'good' : 'warn'
  }
  if (dir === 'flat') return 'neutral'
  return (phase === 'cut') === (dir === 'down') ? 'good' : 'warn'
}

/* ------------------------------------------------------------------ goal */

export interface GoalView {
  phase: Phase
  startKg: number
  currentKg: number
  goalKg: number
  /** 0..1 for the progress bar (clamped). */
  bar: number
  /** Whole-percent progress shown next to the marker (0..100, clamped). */
  pct: number
  /** Distance left to the goal (0 once reached). */
  toGoKg: number
  reached: boolean
  /** The weekly rate points toward the goal (null: no rate yet). */
  onTrack: boolean | null
  /** Projected date the trend reaches the goal (only when on track and within two years). */
  eta: ISODate | null
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Everything the goal card shows. Null without a goal or without any weigh-in. */
export function goalView(p: {
  startKg: number | null | undefined
  currentKg: number | null | undefined
  goalKg: number | null | undefined
  weeklyRateKg: number | null | undefined
  today: ISODate
}): GoalView | null {
  const { startKg, currentKg, goalKg, today } = p
  const phase = phaseOf(startKg, goalKg)
  if (!phase || currentKg == null || !Number.isFinite(currentKg)) return null
  const start = startKg as number
  const goal = goalKg as number
  const left = goal - currentKg
  let reached: boolean
  let bar: number
  if (phase === 'maintain') {
    reached = Math.abs(left) <= MAINTAIN_BAND_KG / 2
    bar = clamp01(1 - Math.abs(left) / (MAINTAIN_BAND_KG * 2))
  } else {
    const progress = (currentKg - start) / (goal - start)
    reached = progress >= 1 || Math.abs(left) < 0.05
    bar = clamp01(progress)
  }
  const rate = p.weeklyRateKg
  let onTrack: boolean | null = null
  let eta: ISODate | null = null
  if (rate != null && Number.isFinite(rate) && !reached && phase !== 'maintain') {
    onTrack = Math.abs(rate) >= 0.05 && Math.sign(rate) === Math.sign(left)
    if (onTrack) {
      const weeks = Math.abs(left) / Math.abs(rate)
      if (weeks <= 104) eta = addDays(today, Math.max(1, Math.round(weeks * 7)))
    }
  }
  return {
    phase,
    startKg: start,
    currentKg,
    goalKg: goal,
    bar,
    pct: Math.round(bar * 100),
    toGoKg: reached ? 0 : Math.abs(left),
    reached,
    onTrack,
    eta,
  }
}

/**
 * Maintenance gauge: the track spans goal ± `spanKg`, the goal sits in the middle and the "on target" band covers
 * ± half the maintenance band. Positions are 0..1 along the track.
 */
export function maintainGauge(currentKg: number, goalKg: number, spanKg = 2): { pos: number; bandFrom: number; bandTo: number } {
  const half = MAINTAIN_BAND_KG / 2 / (2 * spanKg)
  return { pos: clamp01(0.5 + (currentKg - goalKg) / (2 * spanKg)), bandFrom: 0.5 - half, bandTo: 0.5 + half }
}

/* ------------------------------------------------------------------ ranges */

export type Range = '1M' | '3M' | 'all'
export const RANGES: Range[] = ['1M', '3M', 'all']
const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = { '1M': 30, '3M': 91 }

/** First date shown for a range (null = everything). */
export function rangeFrom(range: Range, today: ISODate): ISODate | null {
  return range === 'all' ? null : addDays(today, -(RANGE_DAYS[range] - 1))
}

/** Keeps points on/after `from`. The trend is computed on the full history first, so it is already warmed up. */
export function clipSeries<T extends { date: ISODate }>(points: T[], from: ISODate | null): T[] {
  return from ? points.filter((p) => p.date >= from) : points
}

/* ------------------------------------------------------------------ units */

/** Round to one decimal in the display unit (what a stepper shows). */
export const round1 = (x: number): number => Math.round(x * 10) / 10

/** kg -> display value, rounded to 0.1. */
export const toDisplay = (kg: number, unit: Unit): number => round1(kgToUnit(kg, unit))

/** Display value -> kg to store (2 decimals keeps lb round-trips exact at 0.1 lb). */
export const fromDisplay = (v: number, unit: Unit): number => Math.round(unitToKg(v, unit) * 100) / 100

/**
 * Where the weigh-in stepper starts: the latest weigh-in, else the goal weight (closer to a real first weigh-in
 * than any constant), else 75 kg (165 lb).
 */
export function stepperStart(latestKg: number | null | undefined, unit: Unit, goalKg?: number | null): number {
  if (latestKg != null && latestKg > 0) return toDisplay(latestKg, unit)
  if (goalKg != null && goalKg > 0) return toDisplay(goalKg, unit)
  return unit === 'lb' ? 165 : 75
}

/** Sensible bounds for a typed body weight. */
export const WEIGHT_LIMITS: Record<Unit, { min: number; max: number }> = { kg: { min: 30, max: 250 }, lb: { min: 66, max: 550 } }

/**
 * Bounds handed to the weigh-in Stepper. Deliberately wider than WEIGHT_LIMITS: the Stepper clamps whatever is typed,
 * and a silent clamp turns "725" (forgotten comma) into a saved 250 kg. With these, the typed value survives, the
 * screen shows it as out of range and offers the likely fix.
 */
export const STEPPER_BOUNDS = { min: 0, max: 9999.9 } as const

export function validWeight(v: number | null, unit: Unit): v is number {
  const l = WEIGHT_LIMITS[unit]
  return v != null && Number.isFinite(v) && v >= l.min && v <= l.max
}

/** Optional weigh-in extras: body fat (%) and waist (cm). */
export const BODY_FAT_LIMITS = { min: 2, max: 70 } as const
export const WAIST_LIMITS = { min: 40, max: 200 } as const

/** An optional typed extra ("" or a number within `limits`). The field shows it as typed, so it is checked before saving. */
export function validExtra(s: string, limits: { min: number; max: number }): boolean {
  if (!s.trim()) return true
  const n = parseNum(s)
  return n != null && n >= limits.min && n <= limits.max
}

/**
 * The likely intended value for an out-of-range weight: "725" → 72.5 and "7250" → 72.5 (forgotten comma),
 * "8,3" → 83 (comma one digit early). With a reference weigh-in (display unit) the fix must be within 15% of it.
 */
export function suggestWeight(v: number, unit: Unit, refDisplay?: number | null): number | null {
  if (!Number.isFinite(v) || v <= 0 || validWeight(v, unit)) return null
  const cands = v > WEIGHT_LIMITS[unit].max ? [v / 10, v / 100] : Number.isInteger(v) ? [] : [v * 10]
  for (const raw of cands) {
    const c = round1(raw)
    if (!validWeight(c, unit)) continue
    if (refDisplay != null && refDisplay > 0 && Math.abs(c - refDisplay) / refDisplay > 0.15) continue
    return c
  }
  return null
}

/** The weigh-in closest in time to `date` on another day (ties: the earlier one), ignoring `excludeId`. */
export function nearestEntry(entries: WeightEntry[], date: ISODate, excludeId?: string | null): WeightEntry | null {
  let best: WeightEntry | null = null
  let bestGap = Infinity
  for (const e of entries) {
    if (!(e.kg > 0) || e.date === date || e.id === excludeId) continue
    const gap = Math.abs(diffDays(e.date, date))
    if (gap < bestGap || (gap === bestGap && best && e.date < best.date)) {
      best = e
      bestGap = gap
    }
  }
  return best
}

/**
 * A weigh-in more than this fraction away from the nearest one asks "is the number right?" (38,3 typed for 83,8).
 * The allowance grows by 1% for every week between the two, so a real change after a break still saves in one tap.
 */
export const JUMP_CONFIRM = 0.05

/** Signed change (kg) vs the reference weigh-in when it is big enough to confirm, else null. */
export function bigJumpKg(kg: number, date: ISODate, ref: WeightEntry | null): number | null {
  if (!ref || !(ref.kg > 0) || !Number.isFinite(kg)) return null
  const weeks = Math.abs(diffDays(ref.date, date)) / 7
  const allowed = JUMP_CONFIRM + 0.01 * Math.max(0, weeks - 1)
  const d = kg - ref.kg
  return Math.abs(d) / ref.kg > allowed ? d : null
}

/* ------------------------------------------------------------------ history */

export interface HistoryRow {
  entry: WeightEntry
  /** Change vs the previous (older) weigh-in, null for the first one. */
  deltaKg: number | null
}

/** Newest first, each with the change since the weigh-in before it. */
export function historyRows(entries: WeightEntry[]): HistoryRow[] {
  const asc = entries.filter((e) => e.kg > 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return asc.map((entry, i) => ({ entry, deltaKg: i ? entry.kg - asc[i - 1].kg : null })).reverse()
}

/** The most recent weigh-in (by date). */
export function latestEntry(entries: WeightEntry[]): WeightEntry | null {
  let best: WeightEntry | null = null
  for (const e of entries) if (e.kg > 0 && (!best || e.date > best.date)) best = e
  return best
}

/* ------------------------------------------------------------------ visibility */

export type WeightMode = 'exact' | 'change' | 'hidden'

/** How `viewer` may see `member`'s weight: themselves and the coach see everything; others follow the member's setting. */
export function weightModeFor(viewer: Pick<Member, 'id' | 'role'> | null | undefined, member: Pick<Member, 'id' | 'settings'>): WeightMode {
  if (viewer && (viewer.id === member.id || viewer.role === 'coach')) return 'exact'
  const v = member.settings?.weightVisibility ?? 'exact'
  return v === 'private' ? 'hidden' : v
}

/** Members may edit their own weigh-ins and goal; the coach may edit anyone's. */
export const canEditBody = (viewer: Pick<Member, 'id' | 'role'> | null | undefined, memberId: string): boolean =>
  !!viewer && (viewer.id === memberId || viewer.role === 'coach')

/* ------------------------------------------------------------------ change-from-start series */

export interface ChangePoint {
  date: ISODate
  /** Trend minus the start weigh-in (kg). */
  trendKg: number
  /** Raw weigh-in minus the start weigh-in (kg). */
  rawKg: number
  /** Trend change as a fraction of the start weight (-0.018 = -1.8%). */
  pct: number
}

/**
 * Change since the start (the program start when given, as in weightStats), recomputed from the start weigh-in
 * so every line begins at exactly 0: that makes a fair race between members who started at different weights.
 */
export function changeSeries(entries: WeightEntry[], since?: ISODate | null): ChangePoint[] {
  const stats = weightStats(entries, since ?? null)
  if (!stats) return []
  const series: TrendPoint[] = weightSeries(entries.filter((e) => e.date >= stats.startDate))
  const base = stats.startKg
  return series.map((p) => ({ date: p.date, trendKg: p.trendKg - base, rawKg: p.kg - base, pct: (p.trendKg - base) / base }))
}

/* ------------------------------------------------------------------ chart helpers */

/**
 * Whether a goal line belongs on a chart of these values: close enough that including it doesn't squash the data
 * into a thin band (within twice the data's span, and never less than 2.5 kg away).
 */
export function goalFits(values: number[], goal: number | null | undefined, unit: Unit): boolean {
  if (goal == null || !values.length) return false
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  if (goal >= lo && goal <= hi) return true
  const gap = goal < lo ? lo - goal : goal - hi
  const room = Math.max(2 * (hi - lo), kgToUnit(2.5, unit))
  return gap <= room
}

/** Days since a date, for "3 days ago" style captions. */
export const daysSince = (date: ISODate, today: ISODate): number => diffDays(date, today)
