import type { WeightEntry } from '../../data/types'
import type { ISODate } from '../dates'
import { addDays, diffDays } from '../dates'

export interface TrendPoint {
  date: ISODate
  /** The weigh-in as entered. */
  kg: number
  /** Smoothed trend (exponential moving average, 20% per day, time-aware: close to a 7-day average). */
  trendKg: number
}

/** Daily smoothing factor of the weight trend: responsive enough to feel current, calm enough to hide water swings. */
export const TREND_ALPHA = 0.2

/** Weigh-ins sorted by date with a smoothed trend line (Hacker's Diet style, robust to gaps). */
export function weightSeries(entries: WeightEntry[]): TrendPoint[] {
  const sorted = [...entries].filter((e) => e.kg > 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const out: TrendPoint[] = []
  let trend = 0
  let prev: ISODate | null = null
  for (const e of sorted) {
    if (prev == null) trend = e.kg
    else {
      const gap = Math.max(1, diffDays(prev, e.date))
      const alpha = 1 - Math.pow(1 - TREND_ALPHA, gap)
      trend = trend + alpha * (e.kg - trend)
    }
    out.push({ date: e.date, kg: e.kg, trendKg: trend })
    prev = e.date
  }
  return out
}

/** Least-squares slope (per day) of y over x-days; null with < 2 points or < 5 days span. */
function slopePerDay(pts: { x: number; y: number }[]): number | null {
  if (pts.length < 2) return null
  const span = pts[pts.length - 1].x - pts[0].x
  if (span < 5) return null
  const n = pts.length
  const mx = pts.reduce((a, p) => a + p.x, 0) / n
  const my = pts.reduce((a, p) => a + p.y, 0) / n
  let num = 0
  let den = 0
  for (const p of pts) {
    num += (p.x - mx) * (p.y - my)
    den += (p.x - mx) ** 2
  }
  return den ? num / den : null
}

export interface WeightStats {
  startDate: ISODate
  startKg: number
  latestDate: ISODate
  latestKg: number
  trendKg: number
  changeKg: number
  changePct: number
  /** kg per week over the last 4 weeks of trend (negative = losing). null with too little data. */
  weeklyRateKg: number | null
  lowestKg: number
  highestKg: number
  entries: number
}

/**
 * Summary since `since` (e.g. the program start). The starting point is the first weigh-in on/after `since`,
 * or the last weigh-in before it when that is closer than 14 days (people often weigh in the day before).
 */
export function weightStats(entries: WeightEntry[], since?: ISODate | null, today?: ISODate): WeightStats | null {
  const series = weightSeries(entries)
  if (!series.length) return null
  let startIdx = 0
  if (since) {
    const i = series.findIndex((p) => p.date >= since)
    if (i === -1) startIdx = series.length - 1
    else if (i > 0 && diffDays(series[i - 1].date, since) <= 14 && diffDays(series[i - 1].date, since) < diffDays(since, series[i].date)) startIdx = i - 1
    else startIdx = i
  }
  const window = series.slice(startIdx)
  const start = window[0]
  const last = series[series.length - 1]
  const end = today ?? last.date
  const recent = series.filter((p) => p.date >= addDays(end, -28))
  const slope = slopePerDay(recent.map((p) => ({ x: diffDays(recent[0].date, p.date), y: p.trendKg })))
  return {
    startDate: start.date,
    startKg: start.kg,
    latestDate: last.date,
    latestKg: last.kg,
    trendKg: last.trendKg,
    changeKg: last.trendKg - start.kg,
    changePct: (last.trendKg - start.kg) / start.kg,
    weeklyRateKg: slope == null ? null : slope * 7,
    lowestKg: Math.min(...window.map((p) => p.kg)),
    highestKg: Math.max(...window.map((p) => p.kg)),
    entries: window.length,
  }
}

/** Progress from start to goal, 0..1 (can exceed 1 when overshooting; negative when moving away). */
export function goalProgress(startKg: number, currentKg: number, goalKg: number | null): number | null {
  if (goalKg == null || !Number.isFinite(goalKg)) return null
  const total = goalKg - startKg
  if (Math.abs(total) < 0.05) return Math.abs(currentKg - goalKg) < 0.3 ? 1 : 0
  return (currentKg - startKg) / total
}

/** Consecutive days (ending today or yesterday) with a weigh-in. */
export function weighInStreak(entries: WeightEntry[], today: ISODate): number {
  const days = new Set(entries.map((e) => e.date))
  let d = days.has(today) ? today : addDays(today, -1)
  let n = 0
  while (days.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}
