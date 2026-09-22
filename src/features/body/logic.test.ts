import { describe, expect, it } from 'vitest'
import { mkMember, mkWeight } from '../../lib/testing/fixtures'
import {
  canEditBody,
  changeSeries,
  clipSeries,
  dirOf,
  fromDisplay,
  goalFits,
  goalView,
  historyRows,
  latestEntry,
  maintainGauge,
  phaseOf,
  rangeFrom,
  stepperStart,
  toDisplay,
  toneOf,
  validWeight,
  weightModeFor,
} from './logic'

const W = (date: string, kg: number) => mkWeight('s', date, kg)

describe('phaseOf', () => {
  it('needs a goal and a start', () => {
    expect(phaseOf(80, null)).toBeNull()
    expect(phaseOf(null, 78)).toBeNull()
    expect(phaseOf(80, Number.NaN)).toBeNull()
  })
  it('cut below, bulk above, maintain within 1 kg', () => {
    expect(phaseOf(82.4, 78)).toBe('cut')
    expect(phaseOf(71.5, 75)).toBe('bulk')
    expect(phaseOf(80, 80.6)).toBe('maintain')
    expect(phaseOf(80, 79)).toBe('cut')
  })
})

describe('dirOf / toneOf', () => {
  it('treats tiny changes as flat', () => {
    expect(dirOf(0.04)).toBe('flat')
    expect(dirOf(-0.3)).toBe('down')
    expect(dirOf(0.2)).toBe('up')
    expect(dirOf(Number.NaN)).toBe('flat')
  })
  it('is good toward the goal and warn away from it', () => {
    expect(toneOf(-1.5, 'cut')).toBe('good')
    expect(toneOf(0.4, 'cut')).toBe('warn')
    expect(toneOf(0.4, 'bulk')).toBe('good')
    expect(toneOf(-0.4, 'bulk')).toBe('warn')
    expect(toneOf(0.01, 'cut')).toBe('neutral')
  })
  it('is neutral without a goal', () => {
    expect(toneOf(-2, null)).toBe('neutral')
  })
  it('maintain: good inside the band, warn outside, neutral for day-to-day noise', () => {
    expect(toneOf(0.6, 'maintain')).toBe('good')
    expect(toneOf(-1.4, 'maintain')).toBe('warn')
    expect(toneOf(-1.4, 'maintain', null)).toBe('neutral')
  })
})

describe('goalView', () => {
  const today = '2026-09-24'
  it('is null without a goal or a current weight', () => {
    expect(goalView({ startKg: 82, currentKg: 80, goalKg: null, weeklyRateKg: -0.5, today })).toBeNull()
    expect(goalView({ startKg: null, currentKg: null, goalKg: 78, weeklyRateKg: null, today })).toBeNull()
  })
  it('measures progress from start to goal and projects an ETA from the weekly rate', () => {
    const g = goalView({ startKg: 82.4, currentKg: 80.9, goalKg: 78, weeklyRateKg: -0.6, today })!
    expect(g.phase).toBe('cut')
    expect(g.pct).toBe(34)
    expect(g.toGoKg).toBeCloseTo(2.9, 10)
    expect(g.onTrack).toBe(true)
    // 2.9 / 0.6 = 4.83 weeks = 34 days
    expect(g.eta).toBe('2026-10-28')
  })
  it('has no ETA when the trend moves away or is flat', () => {
    const away = goalView({ startKg: 82, currentKg: 82.5, goalKg: 78, weeklyRateKg: 0.3, today })!
    expect(away.onTrack).toBe(false)
    expect(away.eta).toBeNull()
    expect(away.bar).toBe(0)
    const flat = goalView({ startKg: 82, currentKg: 81, goalKg: 78, weeklyRateKg: 0.01, today })!
    expect(flat.onTrack).toBe(false)
    const none = goalView({ startKg: 82, currentKg: 81, goalKg: 78, weeklyRateKg: null, today })!
    expect(none.onTrack).toBeNull()
    expect(none.eta).toBeNull()
  })
  it('drops an ETA beyond two years', () => {
    expect(goalView({ startKg: 100, currentKg: 99, goalKg: 70, weeklyRateKg: -0.1, today })!.eta).toBeNull()
  })
  it('works for a bulk and marks the goal reached (clamped at 100%)', () => {
    const g = goalView({ startKg: 71.5, currentKg: 75.3, goalKg: 75, weeklyRateKg: 0.25, today })!
    expect(g.phase).toBe('bulk')
    expect(g.reached).toBe(true)
    expect(g.pct).toBe(100)
    expect(g.toGoKg).toBe(0)
    expect(g.eta).toBeNull()
  })
  it('maintain: full bar on target, shrinking with distance', () => {
    const on = goalView({ startKg: 80, currentKg: 80.2, goalKg: 80.5, weeklyRateKg: 0, today })!
    expect(on.phase).toBe('maintain')
    expect(on.reached).toBe(true)
    const off = goalView({ startKg: 80, currentKg: 81.5, goalKg: 80.5, weeklyRateKg: 0.2, today })!
    expect(off.reached).toBe(false)
    expect(off.bar).toBeCloseTo(0.5, 10)
  })
})

describe('maintainGauge', () => {
  it('centers the goal, places the current weight and clamps at the ends', () => {
    expect(maintainGauge(80, 80)).toEqual({ pos: 0.5, bandFrom: 0.375, bandTo: 0.625 })
    expect(maintainGauge(81, 80).pos).toBeCloseTo(0.75, 10)
    expect(maintainGauge(70, 80).pos).toBe(0)
  })
})

describe('ranges', () => {
  it('1M is the last 30 days including today, all is unbounded', () => {
    expect(rangeFrom('1M', '2026-09-24')).toBe('2026-08-26')
    expect(rangeFrom('3M', '2026-09-24')).toBe('2026-06-26')
    expect(rangeFrom('all', '2026-09-24')).toBeNull()
  })
  it('clips by date', () => {
    const pts = [{ date: '2026-08-01' }, { date: '2026-09-01' }]
    expect(clipSeries(pts, '2026-08-15')).toEqual([{ date: '2026-09-01' }])
    expect(clipSeries(pts, null)).toBe(pts)
  })
})

describe('units', () => {
  it('rounds for display and converts back to kg', () => {
    expect(toDisplay(80.94, 'kg')).toBe(80.9)
    expect(toDisplay(81.65, 'lb')).toBe(180)
    expect(fromDisplay(180, 'lb')).toBe(81.65)
    expect(toDisplay(fromDisplay(180.3, 'lb'), 'lb')).toBe(180.3)
  })
  it('starts the stepper at the last weight or a sensible default', () => {
    expect(stepperStart(80.64, 'kg')).toBe(80.6)
    expect(stepperStart(null, 'kg')).toBe(75)
    expect(stepperStart(null, 'lb')).toBe(165)
  })
  it('validates typed weights per unit', () => {
    expect(validWeight(80, 'kg')).toBe(true)
    expect(validWeight(8, 'kg')).toBe(false)
    expect(validWeight(null, 'kg')).toBe(false)
    expect(validWeight(300, 'lb')).toBe(true)
    expect(validWeight(300, 'kg')).toBe(false)
  })
})

describe('historyRows / latestEntry', () => {
  it('lists newest first with the change vs the previous weigh-in', () => {
    const rows = historyRows([W('2026-09-22', 81.1), W('2026-09-20', 81.2), W('2026-09-23', 80.8)])
    expect(rows.map((r) => r.entry.date)).toEqual(['2026-09-23', '2026-09-22', '2026-09-20'])
    expect(rows[0].deltaKg).toBeCloseTo(-0.3, 10)
    expect(rows[1].deltaKg).toBeCloseTo(-0.1, 10)
    expect(rows[2].deltaKg).toBeNull()
  })
  it('finds the latest weigh-in by date, not by insertion order', () => {
    expect(latestEntry([W('2026-09-23', 80.8), W('2026-09-20', 81.2)])?.date).toBe('2026-09-23')
    expect(latestEntry([])).toBeNull()
  })
})

describe('visibility and permissions', () => {
  const me = mkMember({ id: 'me' })
  const coach = mkMember({ id: 'coach', role: 'coach' })
  const priv = mkMember({ id: 'p', settings: { unit: 'kg', machines: {}, weightVisibility: 'private' } })
  const change = mkMember({ id: 'c', settings: { unit: 'kg', machines: {}, weightVisibility: 'change' } })
  const exact = mkMember({ id: 'e', settings: { unit: 'kg', machines: {}, weightVisibility: 'exact' } })
  it('follows the member setting for others', () => {
    expect(weightModeFor(me, priv)).toBe('hidden')
    expect(weightModeFor(me, change)).toBe('change')
    expect(weightModeFor(me, exact)).toBe('exact')
    expect(weightModeFor(null, change)).toBe('change')
  })
  it('always shows members their own weight, and the coach everything', () => {
    expect(weightModeFor(priv, priv)).toBe('exact')
    expect(weightModeFor(coach, priv)).toBe('exact')
  })
  it('lets members edit only their own body data, the coach anyone', () => {
    expect(canEditBody(me, 'me')).toBe(true)
    expect(canEditBody(me, 'p')).toBe(false)
    expect(canEditBody(coach, 'p')).toBe(true)
    expect(canEditBody(null, 'me')).toBe(false)
  })
})

describe('changeSeries', () => {
  it('is empty without data', () => {
    expect(changeSeries([])).toEqual([])
  })
  it('starts at exactly 0 from the start weigh-in and ignores earlier data', () => {
    const s = changeSeries([W('2026-09-01', 90), W('2026-09-07', 80), W('2026-09-08', 79), W('2026-09-09', 79)], '2026-09-07')
    expect(s.map((p) => p.date)).toEqual(['2026-09-07', '2026-09-08', '2026-09-09'])
    expect(s[0]).toMatchObject({ trendKg: 0, rawKg: 0, pct: 0 })
    expect(s[1].rawKg).toBeCloseTo(-1, 10)
    expect(s[1].trendKg).toBeCloseTo(-0.1, 10)
    expect(s[1].pct).toBeCloseTo(-0.1 / 80, 10)
  })
})

describe('goalFits', () => {
  it('keeps a nearby goal on the chart and drops a far one', () => {
    expect(goalFits([80.9, 82.6], 78, 'kg')).toBe(true)
    expect(goalFits([80.9, 81.2], 70, 'kg')).toBe(false)
    expect(goalFits([80, 81], 80.5, 'kg')).toBe(true)
    expect(goalFits([80, 81], null, 'kg')).toBe(false)
    expect(goalFits([], 80, 'kg')).toBe(false)
  })
})
