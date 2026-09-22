import { describe, expect, it } from 'vitest'
import { fromISODate, isoFromMs } from '../../lib/dates'
import {
  areaPath,
  barPath,
  calendarGrid,
  deltaShares,
  formatResolution,
  groupLayout,
  heatLevel,
  labelStride,
  leaderOf,
  linePath,
  linearScale,
  medianGap,
  monotonePath,
  nearestIndex,
  niceDomain,
  niceStep,
  niceTicks,
  paddedExtent,
  placeLabels,
  pointAt,
  stepPath,
  textWidth,
  ticksForStep,
  timeTicks,
  unionX,
} from './scale'

const t = (iso: string) => fromISODate(iso).getTime()
const iso = (ms: number) => isoFromMs(ms)

describe('linearScale', () => {
  it('maps and inverts', () => {
    const s = linearScale([0, 10], [100, 0])
    expect(s(0)).toBe(100)
    expect(s(10)).toBe(0)
    expect(s(2.5)).toBe(75)
    expect(s.invert(75)).toBe(2.5)
  })
  it('maps a zero-width domain to the middle of the range', () => {
    const s = linearScale([5, 5], [0, 200])
    expect(s(5)).toBe(100)
    expect(s.invert(42)).toBe(5)
  })
})

describe('nice ticks', () => {
  it('rounds to the nearest 1/2/2.5/5 step', () => {
    expect(niceStep(10, 5)).toBe(2)
    expect(niceStep(10, 4)).toBe(2.5)
    expect(niceStep(100, 4)).toBe(25)
    expect(niceStep(7, 4)).toBe(2)
    expect(niceStep(0.9, 4)).toBe(0.25)
    expect(niceStep(21100, 4)).toBe(5000) // not 10000: 0..25k beats 0..30k
    expect(niceStep(0, 4)).toBe(1)
  })
  it('never picks fractional steps for integer data', () => {
    expect(niceStep(10, 4, true)).toBe(2)
    expect(niceStep(3, 5, true)).toBe(1)
    expect(niceStep(100, 4, true)).toBe(25)
  })
  it('produces float-safe tick values', () => {
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
    expect(ticksForStep(0.1, 0.35, 0.1)).toEqual([0.1, 0.2, 0.3])
    expect(niceTicks(78.2, 83.1, 4)).toEqual([79, 80, 81, 82, 83])
    expect(niceTicks(0, 100, 2)).toEqual([0, 50, 100])
    expect(niceTicks(-3, 3, 3)).toEqual([-2, 0, 2])
  })
  it('extends a domain to tick boundaries', () => {
    const nd = niceDomain(77.6, 83.5, 4)
    expect(nd.domain).toEqual([76, 84])
    expect(nd.ticks).toEqual([76, 78, 80, 82, 84])
    expect(niceDomain(0, 13, 4, true)).toEqual({ domain: [0, 15], step: 5, ticks: [0, 5, 10, 15] })
    expect(niceDomain(0, 20, 4, true).domain).toEqual([0, 20])
    expect(niceDomain(0, 21100, 4).domain).toEqual([0, 25000])
  })
  it('steps up when tick boundaries would add too many intervals', () => {
    // raw step 1.3 rounds to 1, which would need 6 intervals for 78..84
    const nd = niceDomain(78, 83.1, 4)
    expect(nd.step).toBe(2)
    expect(nd.domain).toEqual([78, 84])
  })
  it('handles a flat domain', () => {
    const nd = niceDomain(80, 80, 4)
    expect(nd.domain[0]).toBeLessThan(80)
    expect(nd.domain[1]).toBeGreaterThan(80)
    expect(niceDomain(0, 0, 4).ticks.length).toBeGreaterThan(1)
  })
  it('pads an extent without crossing zero', () => {
    expect(paddedExtent([80, 84], 0.25, false)).toEqual([79, 85])
    expect(paddedExtent([0, 10], 0.1, false)).toEqual([0, 11])
    expect(paddedExtent([5, 10], 0, true)).toEqual([0, 10])
    expect(paddedExtent([-4, -2], 1, false)).toEqual([-6, 0])
    expect(paddedExtent([], 0.1, false)).toBeNull()
  })
})

describe('printable, capped ticks', () => {
  const oneDec = (n: number) => (Math.round(n * 10) / 10).toString()
  const noDec = (n: number) => Math.round(n).toString()
  const signed = (n: number) => (n > 0 ? '+' : '') + oneDec(n)
  it('measures a formatter resolution', () => {
    expect(formatResolution(oneDec, 78, 84)).toBe(0.1)
    expect(formatResolution(noDec, 30, 45)).toBe(1)
    expect(formatResolution((n) => `${Math.round(n / 1000)} t`, 0, 21100)).toBe(1000)
    expect(formatResolution(signed, -0.3, 1.1)).toBe(0.1)
  })
  it('never picks a step the labels cannot print (the 0.25 kg grid labelled +0.3 / +0.8)', () => {
    const res = formatResolution(signed, -0.25, 1)
    const nd = niceDomain(-0.25, 1, 3, false, { maxIntervals: 3, resolution: res })
    expect(nd.ticks).toEqual([-0.5, 0, 0.5, 1])
    const labels = nd.ticks.map(signed)
    expect(new Set(labels).size).toBe(labels.length)
    // e1RM printed without decimals: no 2.5 steps
    const e = niceDomain(38.4, 45.3, 3, false, { maxIntervals: 3, resolution: 1 })
    expect(e.step % 1).toBe(0)
    // tonnes: steps of whole tonnes
    expect(niceDomain(0, 21100, 3, false, { maxIntervals: 3, resolution: 1000 }).step % 1000).toBe(0)
  })
  it('caps the gridlines at four', () => {
    for (const [lo, hi] of [
      [77.6, 83.5],
      [0, 13],
      [-0.25, 1],
      [80.2, 80.9],
      [0, 21100],
    ]) {
      expect(niceDomain(lo, hi, 3, false, { maxIntervals: 3 }).ticks.length).toBeLessThanOrEqual(4)
      expect(niceTicks(lo, hi, 3, false, { maxIntervals: 3 }).length).toBeLessThanOrEqual(4)
    }
  })
  it('caps time ticks when asked', () => {
    const ticks = timeTicks([t('2026-09-08'), t('2026-09-22')], 1100, () => 40, 12, 4)
    expect(ticks.length).toBeLessThanOrEqual(4)
    expect(ticks.length).toBeGreaterThanOrEqual(2)
  })
})

describe('monotonePath', () => {
  it('passes through every point and never overshoots', () => {
    const pts: [number, number][] = [
      [0, 50],
      [10, 10],
      [20, 12],
      [30, 90],
      [40, 88],
    ]
    const d = monotonePath(pts)
    expect(d.startsWith('M0,50')).toBe(true)
    for (const [x, y] of pts.slice(1)) expect(d).toContain(`${x},${y}`)
    // Control points of each segment stay within that segment's y range (no overshoot).
    const segs = d.split('C').slice(1).map((c) => c.split(/[ ,]/).map(Number))
    segs.forEach((c, i) => {
      const [y0, y1] = [pts[i][1], pts[i + 1][1]]
      const lo = Math.min(y0, y1) - 1e-6
      const hi = Math.max(y0, y1) + 1e-6
      expect(c[1]).toBeGreaterThanOrEqual(lo)
      expect(c[1]).toBeLessThanOrEqual(hi)
      expect(c[3]).toBeGreaterThanOrEqual(lo)
      expect(c[3]).toBeLessThanOrEqual(hi)
    })
  })
  it('falls back to straight lines for two points', () => {
    expect(
      monotonePath([
        [0, 0],
        [10, 10],
      ]),
    ).toBe('M0,0L10,10')
  })
})

describe('timeTicks', () => {
  const label = () => 40 // "22 Sep"
  it('uses daily ticks when there is room', () => {
    const ticks = timeTicks([t('2026-09-01'), t('2026-09-05')], 400, label)
    expect(ticks.map(iso)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'])
  })
  it('falls back to Mondays for a 5-week phone-width axis', () => {
    const ticks = timeTicks([t('2026-08-19'), t('2026-09-22')], 300, label)
    expect(ticks.map(iso)).toEqual(['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'])
    ticks.forEach((x) => expect(fromISODate(iso(x)).getDay()).toBe(1))
  })
  it('never lets labels overlap', () => {
    for (const w of [120, 200, 320, 600, 1000]) {
      const [a, b] = [t('2026-01-01'), t('2026-12-31')]
      const ticks = timeTicks([a, b], w, label)
      const px = ticks.map((x) => ((x - a) / (b - a)) * w)
      px.forEach((p, i) => i && expect(p - px[i - 1]).toBeGreaterThanOrEqual(40 + 12))
    }
  })
  it('uses the first of the month for long ranges', () => {
    const ticks = timeTicks([t('2026-01-10'), t('2026-06-20')], 300, label)
    expect(ticks.map(iso).every((d) => d.endsWith('-01'))).toBe(true)
  })
  it('returns a single tick for a degenerate domain', () => {
    expect(timeTicks([t('2026-09-22'), t('2026-09-22')], 300, label)).toHaveLength(1)
  })
})

describe('labels', () => {
  it('estimates text width monotonically', () => {
    expect(textWidth('')).toBe(0)
    expect(textWidth('100')).toBeGreaterThan(textWidth('10'))
    expect(textWidth('Stelios', 12)).toBeGreaterThan(textWidth('Stelios', 11))
  })
  it('clamps edge labels inside the box and drops overlaps', () => {
    const out = placeLabels(
      [
        { x: 2, w: 30, text: 'a' },
        { x: 20, w: 30, text: 'b' },
        { x: 100, w: 30, text: 'c' },
        { x: 199, w: 30, text: 'd' },
      ],
      0,
      200,
    )
    expect(out.map((l) => l.text)).toEqual(['a', 'c', 'd'])
    expect(out[0].x).toBe(15)
    expect(out[2].x).toBe(185)
  })
  it('keeps the last label and drops its neighbour instead', () => {
    const out = placeLabels(
      [
        { x: 20, w: 30, text: 'a' },
        { x: 80, w: 30, text: 'b' },
        { x: 170, w: 30, text: 'c' },
        { x: 199, w: 30, text: 'today' },
      ],
      0,
      200,
    )
    expect(out.map((l) => l.text)).toEqual(['a', 'b', 'today'])
  })
  it('thins category labels to fit their bands', () => {
    expect(labelStride(40, 20)).toBe(1)
    expect(labelStride(20, 30)).toBe(2)
    expect(labelStride(0, 30)).toBe(1)
  })
})

describe('lookup', () => {
  it('finds the nearest value', () => {
    const xs = [0, 10, 20, 30]
    expect(nearestIndex(xs, -5)).toBe(0)
    expect(nearestIndex(xs, 4)).toBe(0)
    expect(nearestIndex(xs, 6)).toBe(1)
    expect(nearestIndex(xs, 15)).toBe(1)
    expect(nearestIndex(xs, 99)).toBe(3)
    expect(nearestIndex([], 1)).toBe(-1)
  })
  it('unions x values across series, skipping non-finite points', () => {
    expect(unionX([{ points: [{ x: 3, y: 1 }, { x: 1, y: 1 }] }, { points: [{ x: 1, y: 2 }, { x: NaN, y: 1 }, { x: 2, y: NaN }] }])).toEqual([1, 3])
  })
  it('reads step series as held values and linear series as nearest points', () => {
    const pts = [
      { x: 0, y: 1 },
      { x: 10, y: 2 },
      { x: 20, y: 3 },
    ]
    expect(pointAt(pts, 15, 'step', 0)).toEqual({ x: 15, y: 2 })
    expect(pointAt(pts, -1, 'step', 0)).toBeNull()
    expect(pointAt(pts, 25, 'step', 0)?.y).toBe(3)
    expect(pointAt(pts, 14, 'linear', 5)).toEqual({ x: 10, y: 2 })
    expect(pointAt(pts, 26, 'linear', 5)).toBeNull()
    expect(pointAt([], 1, 'linear', 5)).toBeNull()
    expect(medianGap([0, 1, 3, 10])).toBe(2)
    expect(medianGap([5])).toBe(0)
  })
})

describe('paths', () => {
  it('builds polylines, steps and areas', () => {
    expect(linePath([[0, 10], [5.555, 2]])).toBe('M0,10L5.56,2')
    expect(stepPath([[0, 10], [5, 2], [9, 4]])).toBe('M0,10H5V2H9V4')
    expect(areaPath([[0, 10], [5, 2]], 20)).toBe('M0,10L5,2V20H0Z')
    expect(areaPath([], 20)).toBe('')
  })
  it('rounds only the data end of a bar', () => {
    expect(barPath(10, 20, 100, 40, 4)).toBe('M10,100V44A4,4 0 0 1 14,40H26A4,4 0 0 1 30,44V100Z')
    // negative bar: rounded at the bottom
    expect(barPath(10, 20, 100, 160, 4)).toBe('M10,100V156A4,4 0 0 0 14,160H26A4,4 0 0 0 30,156V100Z')
    // radius shrinks for short or thin bars
    expect(barPath(0, 4, 10, 8, 4)).toContain('A2,2')
    expect(barPath(0, 10, 10, 10)).toBe('')
  })
  it('caps grouped bars at 24px with a 2px gap', () => {
    const g = groupLayout(0, 400, 2, 2)
    expect(g.barWidth).toBe(24)
    expect(g.barX(0, 1) - g.barX(0, 0)).toBe(26)
    expect(g.center(1)).toBe(300)
    const tight = groupLayout(0, 120, 12, 2)
    expect(tight.barWidth).toBeLessThan(24)
    expect(tight.groupWidth).toBeLessThanOrEqual(tight.band)
  })
})

describe('calendar heatmap', () => {
  const days = (from: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ date: iso(t(from) + i * 86400000), value: i % 3 === 0 ? null : i }))
  it('lays days out in Monday-first week columns', () => {
    const g = calendarGrid(days('2026-09-02', 10)) // Wed 2 Sep .. Fri 11 Sep
    expect(g.start).toBe('2026-08-31')
    expect(g.weeks).toBe(2)
    expect(g.cells[0]).toMatchObject({ date: '2026-09-02', col: 0, row: 2 })
    expect(g.cells[g.cells.length - 1]).toMatchObject({ date: '2026-09-11', col: 1, row: 4 })
  })
  it('keeps the most recent weeks when space is short', () => {
    const g = calendarGrid(days('2026-06-01', 84), 4)
    expect(g.weeks).toBe(4)
    expect(g.cells.every((c) => c.col >= 0 && c.col < 4)).toBe(true)
    expect(g.cells[g.cells.length - 1].date).toBe('2026-08-23')
  })
  it('maps values to sequential levels', () => {
    expect(heatLevel(null, 10)).toBe(0)
    expect(heatLevel(0, 10)).toBe(0)
    expect(heatLevel(1, 10)).toBe(1)
    expect(heatLevel(5, 10)).toBe(2)
    expect(heatLevel(10, 10)).toBe(4)
    expect(heatLevel(99, 10)).toBe(4)
    expect(heatLevel(3, 0)).toBe(0)
  })
  it('ignores malformed dates and handles empty input', () => {
    expect(calendarGrid([{ date: 'nope', value: 1 }]).cells).toEqual([])
  })
})

describe('two-sided bars', () => {
  it('splits by share or by leader', () => {
    expect(deltaShares(3, 1)).toEqual([0.75, 0.25])
    expect(deltaShares(3, 1, 'leader')).toEqual([1, 1 / 3])
    expect(deltaShares(0, 0)).toEqual([0, 0])
    expect(deltaShares(null, 4)).toEqual([0, 1])
    expect(deltaShares(-2, 4)).toEqual([0, 1])
  })
  it('names the leader', () => {
    expect(leaderOf(13, 11)).toBe('a')
    expect(leaderOf(1, 2)).toBe('b')
    expect(leaderOf(2, 2)).toBe('tie')
    expect(leaderOf(null, 2)).toBeNull()
  })
})
