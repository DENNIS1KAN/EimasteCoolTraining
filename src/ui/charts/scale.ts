/**
 * Pure chart math: scales, nice ticks, time ticks, label placement, nearest-point lookup and SVG path building.
 * No React and no DOM here, so everything is unit-tested directly.
 */
import { addDays, diffDays, fromISODate, isoFromMs, startOfWeek, toISODate, type ISODate } from '../../lib/dates'

export type Domain = [number, number]
export type Curve = 'linear' | 'step'
export interface Pt {
  x: number
  y: number
}

export const DAY_MS = 86400000

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** Round for SVG output: 2 decimals keeps paths short without visible error. */
export const r2 = (n: number): number => Math.round(n * 100) / 100

/** Pixel-snap a hairline so a 1px stroke covers exactly one device pixel at 1x. */
export const crisp = (n: number): number => Math.round(n) + 0.5

/* ------------------------------------------------------------------ linear scale */

export interface LinearScale {
  (v: number): number
  domain: Domain
  range: Domain
  invert(px: number): number
}

export function linearScale(domain: Domain, range: Domain): LinearScale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0
  const k = span === 0 ? 0 : (r1 - r0) / span
  const f = ((v: number) => (k === 0 ? (r0 + r1) / 2 : r0 + (v - d0) * k)) as LinearScale
  f.domain = domain
  f.range = range
  f.invert = (px: number) => (k === 0 ? d0 : d0 + (px - r0) / k)
  return f
}

/* ------------------------------------------------------------------ nice ticks */

const decimalsOf = (step: number): number => {
  const s = String(step)
  if (s.includes('e-')) return Number(s.split('e-')[1]) + (s.split('e-')[0].split('.')[1]?.length ?? 0)
  const i = s.indexOf('.')
  return i < 0 ? 0 : s.length - i - 1
}

const roundTo = (v: number, decimals: number): number => {
  const r = Number(v.toFixed(Math.min(20, decimals)))
  return r === 0 ? 0 : r // no -0
}

/**
 * A "nice" step (1, 2, 2.5 or 5 x 10^n) that splits `span` into about `count` intervals, rounding the raw step
 * to the geometrically nearest candidate. `integer` forbids fractional steps (counts: workouts, reps, PRs).
 */
export function niceStep(span: number, count: number, integer = false): number {
  if (!(span > 0) || !Number.isFinite(span)) return 1
  const raw = span / Math.max(1, count)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const steps = integer && mag < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10]
  let m = steps[0]
  for (let i = 1; i < steps.length; i++) if (norm >= Math.sqrt(steps[i - 1] * steps[i])) m = steps[i]
  const step = Number((m * mag).toPrecision(6))
  return integer ? Math.max(1, Math.round(step)) : step
}

/** The next larger nice step (2 -> 2.5 -> 5 -> 10 -> 20 ...). */
function nextStep(step: number, integer: boolean): number {
  const mag = 10 ** Math.floor(Math.log10(step) + 1e-9)
  const norm = Number((step / mag).toPrecision(6))
  const steps = integer && mag < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10]
  const m = steps.find((s) => s > norm + 1e-9) ?? 10
  return Number((m * mag).toPrecision(6))
}

/** Tick values that are multiples of `step` inside [min, max] (inclusive, float-safe). */
export function ticksForStep(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !Number.isFinite(min) || !Number.isFinite(max) || max < min) return []
  const dec = decimalsOf(step)
  const eps = step * 1e-6
  const first = Math.ceil((min - eps) / step)
  const last = Math.floor((max + eps) / step)
  const out: number[] = []
  for (let i = first; i <= last && out.length < 1000; i++) out.push(roundTo(i * step, dec))
  return out
}

/** About `count` nice ticks inside [min, max]. */
export function niceTicks(min: number, max: number, count: number, integer = false): number[] {
  if (min === max) return [min]
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  let step = niceStep(hi - lo, count, integer)
  while ((hi - lo) / step > Math.max(2, count + 1) + 1e-9) step = nextStep(step, integer)
  return ticksForStep(lo, hi, step)
}

export interface NiceDomain {
  domain: Domain
  step: number
  ticks: number[]
}

/** Extend [min, max] outward to tick boundaries so the top and bottom gridlines carry labels. */
export function niceDomain(min: number, max: number, count: number, integer = false): NiceDomain {
  let lo = Math.min(min, max)
  let hi = Math.max(min, max)
  if (lo === hi) {
    const d = lo === 0 ? 1 : Math.abs(lo) * 0.05
    lo -= d
    hi += d
  }
  let step = niceStep(hi - lo, count, integer)
  let nlo = lo
  let nhi = hi
  // Extending to tick boundaries can add intervals; step up until there are at most count + 1.
  for (let i = 0; i < 8; i++) {
    nlo = Math.floor(lo / step + 1e-9) * step
    nhi = Math.ceil(hi / step - 1e-9) * step
    if (Math.round((nhi - nlo) / step) <= Math.max(2, count + 1)) break
    step = nextStep(step, integer)
  }
  lo = nlo
  hi = nhi
  const dec = decimalsOf(step)
  const domain: Domain = [roundTo(lo, dec), roundTo(hi, dec)]
  return { domain, step, ticks: ticksForStep(domain[0], domain[1], step) }
}

/** How many y ticks a plot of this height can hold comfortably (a label every ~44px). */
export const yTickCount = (plotHeight: number): number => clamp(Math.round(plotHeight / 44), 2, 8)

/**
 * The y extent of the data (plus extra values such as goal lines), padded by `padding` x span on each side,
 * with 0 pulled in when `zero` is set. The padding never crosses zero when all values sit on one side of it.
 */
export function paddedExtent(values: number[], padding: number, zero: boolean): Domain | null {
  const vs = values.filter(Number.isFinite)
  if (zero) vs.push(0)
  if (!vs.length) return null
  const lo = Math.min(...vs)
  const hi = Math.max(...vs)
  const span = hi - lo || Math.abs(hi) * 0.1 || 1
  const pad = span * Math.max(0, padding)
  const nlo = lo >= 0 && lo - pad < 0 ? 0 : lo - pad
  const nhi = hi <= 0 && hi + pad > 0 ? 0 : hi + pad
  return [nlo, nhi]
}

/* ------------------------------------------------------------------ time ticks */

/** Local noon of the calendar day containing `ms` (the app's canonical time for a date). */
export const dayNoon = (ms: number): number => fromISODate(isoFromMs(ms)).getTime()

type TimeInterval = { kind: 'day' | 'week' | 'month'; n: number }
const TIME_INTERVALS: TimeInterval[] = [
  { kind: 'day', n: 1 },
  { kind: 'day', n: 2 },
  { kind: 'week', n: 1 },
  { kind: 'week', n: 2 },
  { kind: 'month', n: 1 },
  { kind: 'month', n: 2 },
  { kind: 'month', n: 3 },
  { kind: 'month', n: 6 },
  { kind: 'month', n: 12 },
]

function ticksForInterval(min: number, max: number, iv: TimeInterval): number[] {
  const endIso = isoFromMs(max)
  const out: ISODate[] = []
  const startIso = isoFromMs(min)
  if (iv.kind === 'day') {
    for (let d = startIso; d <= endIso && out.length < 400; d = addDays(d, iv.n)) out.push(d)
  } else if (iv.kind === 'week') {
    let d = startOfWeek(startIso)
    if (d < startIso) d = addDays(d, 7)
    // Keep a stable phase (even ISO weeks for 2-week steps) so ticks don't jump when the domain slides by a day.
    if (iv.n > 1 && Math.floor(diffDays('2000-01-03', d) / 7) % iv.n !== 0) d = addDays(d, 7)
    for (; d <= endIso && out.length < 400; d = addDays(d, 7 * iv.n)) out.push(d)
  } else {
    const s = fromISODate(startIso)
    let y = s.getFullYear()
    let m = s.getMonth() + (s.getDate() > 1 ? 1 : 0)
    for (let guard = 0; guard < 400; guard++) {
      if (m > 11) {
        y += Math.floor(m / 12)
        m %= 12
      }
      if (m % iv.n === 0) {
        const d = toISODate(new Date(y, m, 1, 12))
        if (d > endIso) break
        out.push(d)
      }
      m++
    }
  }
  return out.map((d) => fromISODate(d).getTime())
}

/**
 * Date ticks for a time axis: the densest calendar-aligned interval (days, Mondays, 1st of the month...)
 * whose labels don't overlap at this pixel width. `labelWidth` estimates a label's rendered width.
 */
export function timeTicks(domain: Domain, pixelWidth: number, labelWidth: (t: number) => number, gap = 12): number[] {
  const [min, max] = domain
  if (!(max > min) || pixelWidth <= 0) return [dayNoon(min)]
  const px = (t: number) => ((t - min) / (max - min)) * pixelWidth
  let fallback: number[] = [dayNoon(max)]
  for (const iv of TIME_INTERVALS) {
    const ticks = ticksForInterval(min, max, iv).filter((t) => t >= min && t <= max)
    if (!ticks.length) continue
    fallback = ticks
    const fits = ticks.every((t, i) => i === 0 || px(t) - px(ticks[i - 1]) >= (labelWidth(t) + labelWidth(ticks[i - 1])) / 2 + gap)
    if (fits) return ticks
  }
  return fallback.slice(-1)
}

/* ------------------------------------------------------------------ labels */

/** Rough rendered width of `s` at `fontSize` px in the UI sans (no DOM needed; errs slightly wide). */
export function textWidth(s: string, fontSize = 11): number {
  let em = 0
  for (const ch of s) {
    if (/[0-9]/.test(ch)) em += 0.56
    else if (/[\s.,:;'|!ilIj1()[\]]/.test(ch)) em += 0.3
    else if (/[mwMW@%]/.test(ch)) em += 0.86
    else if (/[A-ZΑ-Ω]/.test(ch)) em += 0.64
    else em += 0.55
  }
  return Math.ceil(em * fontSize)
}

export interface AxisLabel {
  x: number
  w: number
  text: string
}

/**
 * Keep axis labels inside [lo, hi] and drop the ones that would overlap a kept neighbour.
 * The first and last labels are clamped to the edges rather than clipped.
 */
export function placeLabels<T extends AxisLabel>(labels: T[], lo: number, hi: number, gap = 8): T[] {
  const out: T[] = []
  const overlaps = (a: T, b: T) => b.x - b.w / 2 < a.x + a.w / 2 + gap
  labels.forEach((l, i) => {
    const placed = { ...l, x: clamp(l.x, lo + l.w / 2, hi - l.w / 2) }
    const prev = out[out.length - 1]
    if (prev && overlaps(prev, placed)) {
      // The last label (usually "today") wins over its neighbour, if that is enough to make room.
      const before = out[out.length - 2]
      if (i !== labels.length - 1 || (before && overlaps(before, placed))) return
      out.pop()
    }
    out.push(placed)
  })
  return out
}

/** Show every k-th category label so the labels fit their bands. */
export function labelStride(bandWidth: number, maxLabelWidth: number, gap = 6): number {
  if (bandWidth <= 0) return 1
  return Math.max(1, Math.ceil((maxLabelWidth + gap) / bandWidth))
}

/* ------------------------------------------------------------------ lookup */

/** Index of the value in ascending `sorted` closest to `x` (-1 when empty). */
export function nearestIndex(sorted: number[], x: number): number {
  if (!sorted.length) return -1
  let lo = 0
  let hi = sorted.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < x) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && Math.abs(sorted[lo - 1] - x) <= Math.abs(sorted[lo] - x)) return lo - 1
  return lo
}

/** Sorted unique x values across all series. */
export function unionX(series: { points: Pt[] }[]): number[] {
  const s = new Set<number>()
  for (const se of series) for (const p of se.points) if (Number.isFinite(p.x) && Number.isFinite(p.y)) s.add(p.x)
  return [...s].sort((a, b) => a - b)
}

/**
 * A series' reading at `x` for the crosshair.
 * - step: the value held since the last point at or before x (cumulative counts, running bests).
 * - linear: the series' nearest point, as long as x is within `tol` of the series' extent.
 */
export function pointAt(points: Pt[], x: number, curve: Curve, tol: number): Pt | null {
  if (!points.length) return null
  const first = points[0]
  const last = points[points.length - 1]
  if (curve === 'step') {
    if (x < first.x - 1e-9) return null
    let held = first
    for (const p of points) {
      if (p.x <= x + 1e-9) held = p
      else break
    }
    return { x: Math.min(x, Math.max(held.x, last.x)), y: held.y }
  }
  if (x < first.x - tol || x > last.x + tol) return null
  const i = nearestIndex(
    points.map((p) => p.x),
    x,
  )
  return points[i]
}

/** Median gap between consecutive values (0 with fewer than two). */
export function medianGap(sorted: number[]): number {
  if (sorted.length < 2) return 0
  const gaps = sorted.slice(1).map((v, i) => v - sorted[i]).sort((a, b) => a - b)
  return gaps[gaps.length >> 1]
}

/* ------------------------------------------------------------------ paths */

/** Polyline through screen points. */
export function linePath(pts: [number, number][]): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)},${r2(y)}`).join('')
}

/** Step-after path: holds each value until the next point. */
export function stepPath(pts: [number, number][]): string {
  if (!pts.length) return ''
  let d = `M${r2(pts[0][0])},${r2(pts[0][1])}`
  for (let i = 1; i < pts.length; i++) d += `H${r2(pts[i][0])}V${r2(pts[i][1])}`
  return d
}

export const curvePath = (pts: [number, number][], curve: Curve): string => (curve === 'step' ? stepPath(pts) : linePath(pts))

/** Closed area between the curve and the horizontal baseline `y0`. */
export function areaPath(pts: [number, number][], y0: number, curve: Curve = 'linear'): string {
  if (!pts.length) return ''
  const top = curvePath(pts, curve)
  return `${top}V${r2(y0)}H${r2(pts[0][0])}Z`
}

/**
 * A bar from baseline `y0` to its data end `y1`, `w` wide at `x`: the data end has rounded corners (radius `r`,
 * shrunk for thin or short bars), the baseline end stays square. Works for bars growing up or down.
 */
export function barPath(x: number, w: number, y0: number, y1: number, r = 4): string {
  const h = Math.abs(y0 - y1)
  if (h < 0.01 || w <= 0) return ''
  const rr = Math.max(0, Math.min(r, w / 2, h))
  const up = y1 < y0
  const s = up ? 1 : -1 // direction from the data end back toward the baseline
  const sweep = up ? 1 : 0
  return (
    `M${r2(x)},${r2(y0)}` +
    `V${r2(y1 + s * rr)}` +
    `A${r2(rr)},${r2(rr)} 0 0 ${sweep} ${r2(x + rr)},${r2(y1)}` +
    `H${r2(x + w - rr)}` +
    `A${r2(rr)},${r2(rr)} 0 0 ${sweep} ${r2(x + w)},${r2(y1 + s * rr)}` +
    `V${r2(y0)}Z`
  )
}

/* ------------------------------------------------------------------ bands (bar charts) */

export interface GroupLayout {
  band: number
  barWidth: number
  groupWidth: number
  /** x of bar `j` inside category `i`. */
  barX(i: number, j: number): number
  center(i: number): number
}

/** Grouped-bar geometry: bars are capped at `maxBar` px, separated by `gap` px, and the rest of the band is air. */
export function groupLayout(x0: number, width: number, categories: number, seriesCount: number, maxBar = 24, gap = 2, fill = 0.7): GroupLayout {
  const n = Math.max(1, categories)
  const m = Math.max(1, seriesCount)
  const band = width / n
  const avail = band * fill - gap * (m - 1)
  const barWidth = Math.max(2, Math.min(maxBar, Math.floor(avail / m)))
  const groupWidth = barWidth * m + gap * (m - 1)
  const center = (i: number) => x0 + band * (i + 0.5)
  return {
    band,
    barWidth,
    groupWidth,
    center,
    barX: (i, j) => center(i) - groupWidth / 2 + j * (barWidth + gap),
  }
}

/* ------------------------------------------------------------------ calendar heatmap */

export interface HeatCell {
  date: ISODate
  value: number | null
  /** Week column, 0 = oldest shown week. */
  col: number
  /** Day row, 0 = Monday. */
  row: number
}

export interface HeatGrid {
  cells: HeatCell[]
  weeks: number
  /** Monday of the first column. */
  start: ISODate
}

/** Lay out calendar days in week columns (Mon..Sun rows). Keeps only the most recent `maxWeeks` columns. */
export function calendarGrid(days: { date: string; value: number | null }[], maxWeeks = Infinity): HeatGrid {
  const valid = days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (!valid.length) return { cells: [], weeks: 0, start: '' }
  const lastWeek = startOfWeek(valid[valid.length - 1].date)
  let start = startOfWeek(valid[0].date)
  let weeks = diffDays(start, lastWeek) / 7 + 1
  if (weeks > maxWeeks) {
    weeks = Math.max(1, Math.floor(maxWeeks))
    start = addDays(lastWeek, -7 * (weeks - 1))
  }
  const byDate = new Map<string, number | null>()
  for (const d of valid) byDate.set(d.date, d.value)
  const cells: HeatCell[] = []
  for (const [date, value] of byDate) {
    if (date < start) continue
    const off = diffDays(start, date)
    cells.push({ date, value: value != null && Number.isFinite(value) ? value : null, col: Math.floor(off / 7), row: off % 7 })
  }
  return { cells, weeks, start }
}

/** Sequential level for a heat cell: 0 = zero/none, 1..levels by share of `max`. */
export function heatLevel(value: number | null, max: number, levels = 4): number {
  if (value == null || !(value > 0) || !(max > 0)) return 0
  return clamp(Math.ceil((value / max) * levels - 1e-9), 1, levels)
}

/* ------------------------------------------------------------------ two-sided bars */

export type Leader = 'a' | 'b' | 'tie' | null

/** Who leads (higher is better); null when either side is missing. */
export function leaderOf(a: number | null | undefined, b: number | null | undefined, eps = 1e-9): Leader {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null
  if (Math.abs(a - b) <= eps) return 'tie'
  return a > b ? 'a' : 'b'
}

/**
 * Bar lengths (0..1 of each half) for a two-sided comparison.
 * share: value / (a + b). leader: value / max(a, b). Missing and negative values draw nothing.
 */
export function deltaShares(a: number | null | undefined, b: number | null | undefined, mode: 'share' | 'leader' = 'share'): [number, number] {
  const va = a != null && Number.isFinite(a) ? Math.max(0, a) : 0
  const vb = b != null && Number.isFinite(b) ? Math.max(0, b) : 0
  const den = mode === 'share' ? va + vb : Math.max(va, vb)
  if (!(den > 0)) return [0, 0]
  return [va / den, vb / den]
}
