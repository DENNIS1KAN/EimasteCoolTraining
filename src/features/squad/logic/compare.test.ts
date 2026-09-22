import { describe, expect, it } from 'vitest'
import { MINI, at, mkLog, mkWeight } from '../../../lib/testing/fixtures'
import { fromISODate } from '../../../lib/dates'
import { weightSeries, type H2HRow } from '../../../lib/stats'
import {
  bodyWeightOn,
  commonExercises,
  exerciseRegion,
  lastWeeks,
  liftDuelPoints,
  liftTallies,
  raceSeries,
  raceStart,
  summaryClauses,
  volumeWeeks,
  weeklyVolume,
  weightChangeSeries,
} from './compare'

const programs = { [MINI.id]: MINI }
const S = 'stelios'
const T = 'thanos'
const ms = (d: string) => fromISODate(d).getTime()

describe('race', () => {
  const logs = [
    mkLog({ member: S, week: 1, day: 0, doneAt: at('2026-03-23') }),
    mkLog({ member: S, week: 1, day: 1, doneAt: at('2026-03-25', 23, 30) }),
    mkLog({ member: S, week: 1, day: 2, done: false, doneAt: null, startedAt: at('2026-03-27') }),
  ]
  it('starts at the earlier program start, else the first finished workout', () => {
    expect(raceStart(['2026-03-23', '2026-03-16'], [], '2026-03-31')).toBe('2026-03-16')
    expect(raceStart([null, '2026-04-06'], logs, '2026-03-31')).toBe('2026-03-23')
    expect(raceStart([null, null], [], '2026-03-31')).toBeNull()
  })
  it('counts finished workouts cumulatively per day', () => {
    const pts = raceSeries(logs, '2026-03-22', '2026-03-26')
    expect(pts.map((p) => p.y)).toEqual([0, 1, 1, 2, 2])
    expect(pts[0].x).toBe(ms('2026-03-22'))
    // workouts before the window count as the starting point
    expect(raceSeries(logs, '2026-03-24', '2026-03-24').map((p) => p.y)).toEqual([1])
    expect(raceSeries(logs, '2026-04-01', '2026-03-31')).toEqual([])
  })
})

describe('weekly volume', () => {
  it('lists the last calendar weeks and sums finished volume per week', () => {
    const weeks = lastWeeks('2026-04-01', 3)
    expect(weeks).toEqual(['2026-03-16', '2026-03-23', '2026-03-30'])
    const logs = [
      mkLog({ member: S, week: 1, day: 0, doneAt: at('2026-03-23'), ex: { 0: { sets: [['100', '5'], ['100', '5']] } } }),
      mkLog({ member: S, week: 1, day: 1, doneAt: at('2026-03-29'), ex: { 0: { sets: [['50', '10']] } } }),
      mkLog({ member: S, week: 2, day: 0, doneAt: at('2026-03-30'), ex: { 0: { sets: [['20', '10']] } } }),
      mkLog({ member: S, week: 2, day: 1, done: false, doneAt: null, ex: { 0: { sets: [['999', '10']] } } }),
    ]
    expect(weeklyVolume(logs, programs, weeks)).toEqual([0, 1500, 200])
  })
})

describe('lift duel', () => {
  const a = [
    mkLog({ member: S, week: 1, day: 0, doneAt: at('2026-03-23'), ex: { 0: { sets: [['100', '5']] }, 1: { sets: [['60', '10']] } } }),
    mkLog({ member: S, week: 2, day: 0, doneAt: at('2026-03-30'), ex: { 0: { sets: [['105', '5']] } } }),
  ]
  const b = [
    mkLog({ member: T, week: 1, day: 0, doneAt: at('2026-03-24'), ex: { 0: { sets: [['90', '8']] } } }),
    mkLog({ member: T, week: 1, day: 1, doneAt: at('2026-03-26'), ex: { 0: { sets: [['140', '8']] } } }),
  ]
  it('finds exercises both performed, heaviest first', () => {
    expect(commonExercises(a, b, programs)).toEqual(['Bench Press'])
    const c = [...a, mkLog({ member: S, week: 1, day: 1, doneAt: at('2026-03-25'), ex: { 0: { sets: [['140', '5']] } } })]
    expect(commonExercises(c, b, programs)).toEqual(['Squat', 'Bench Press'])
  })
  it('plots best e1RM per day, optionally relative to body weight', () => {
    const pts = liftDuelPoints(a, programs, 'Bench Press')
    expect(pts.map((p) => Math.round(p.y * 10) / 10)).toEqual([116.7, 122.5])
    const bw = weightSeries([mkWeight(S, '2026-03-23', 80), mkWeight(S, '2026-03-30', 80)])
    const rel = liftDuelPoints(a, programs, 'Bench Press', bw)
    expect(rel[0].y).toBeCloseTo(116.667 / 80, 3)
    expect(liftDuelPoints(a, programs, 'Bench Press', [])).toEqual([])
  })
  it('reads trend body weight on a date', () => {
    const series = weightSeries([mkWeight(S, '2026-03-23', 80), mkWeight(S, '2026-03-30', 78)])
    expect(bodyWeightOn(series, '2026-03-20')).toBe(80)
    expect(bodyWeightOn(series, '2026-03-25')).toBe(80)
    expect(bodyWeightOn(series, '2026-04-02')).toBeCloseTo(series[1].trendKg)
    expect(bodyWeightOn([], '2026-04-02')).toBeNull()
  })
  it('tallies who lifts more per body region', () => {
    expect(liftTallies(a, b, programs)).toEqual([{ region: 'push', a: 1, b: 0 }])
  })
})

describe('volume weeks', () => {
  it('shows the last 6 weeks, but none before the week the race started', () => {
    expect(volumeWeeks('2026-03-25', null)).toEqual(lastWeeks('2026-03-25', 6))
    expect(volumeWeeks('2026-04-08', '2026-03-25')).toEqual(['2026-03-23', '2026-03-30', '2026-04-06'])
    expect(volumeWeeks('2026-06-10', '2026-03-25')).toEqual(lastWeeks('2026-06-10', 6))
    expect(volumeWeeks('2026-03-25', '2026-03-25')).toEqual(['2026-03-23'])
  })
})

describe('weight change series', () => {
  it('is relative to the starting weigh-in', () => {
    const pts = weightChangeSeries([mkWeight(S, '2026-03-23', 80), mkWeight(S, '2026-03-30', 78)], '2026-03-23')
    expect(pts[0].y).toBe(0)
    expect(pts[1].y).toBeLessThan(0)
    expect(weightChangeSeries([], null)).toEqual([])
  })
  it('starts at exactly 0 even with weigh-ins before the program start', () => {
    const pre = [mkWeight(S, '2026-03-16', 84), mkWeight(S, '2026-03-19', 83)]
    const pts = weightChangeSeries([...pre, mkWeight(S, '2026-03-23', 80), mkWeight(S, '2026-03-26', 79.5)], '2026-03-23')
    expect(pts.map((p) => p.x)).toEqual([ms('2026-03-23'), ms('2026-03-26')])
    expect(pts[0].y).toBe(0)
    // The trend restarts at 80 kg (not dragged up by the heavier pre-start weigh-ins).
    expect(pts[1].y).toBeLessThan(0)
    expect(pts[1].y).toBeGreaterThan(-0.5 / 80)
  })
})

describe('summary', () => {
  it('classifies exercises by region', () => {
    expect(exerciseRegion('Leg Press')).toBe('legs')
    expect(exerciseRegion('Smith Machine Squat')).toBe('legs')
    expect(exerciseRegion('Neutral-Grip Lat Pulldown')).toBe('pull')
    expect(exerciseRegion('Chest-Supported T-Bar Row')).toBe('pull')
    expect(exerciseRegion('Bench Press')).toBe('push')
    expect(exerciseRegion('Machine Shoulder Press')).toBe('push')
    expect(exerciseRegion('Cable Crunch')).toBeNull()
  })
  const rows: H2HRow[] = [
    { key: 'points', a: 10, b: 5, winner: 'a' },
    { key: 'consistency', a: 0.9, b: 0.8, winner: 'a' },
    { key: 'volumeWeek', a: 100, b: 200, winner: 'b' },
    { key: 'prs', a: 3, b: 3, winner: 'tie' },
  ]
  it("puts the rival's edge first and ends on the viewer's", () => {
    const tallies = [{ region: 'legs' as const, a: 0, b: 2 }]
    expect(summaryClauses(rows, tallies, 'a')).toEqual([
      { kind: 'lifts', who: 'b', region: 'legs' },
      { kind: 'consistency', who: 'a' },
    ])
    expect(summaryClauses(rows, tallies, 'b')).toEqual([
      { kind: 'consistency', who: 'a' },
      { kind: 'lifts', who: 'b', region: 'legs' },
    ])
  })
  it('uses two facts from one side when the other leads nowhere', () => {
    const oneSided: H2HRow[] = rows.map((r) => (r.key === 'volumeWeek' ? { ...r, winner: 'a' } : r))
    expect(summaryClauses(oneSided, [], null)).toEqual([
      { kind: 'consistency', who: 'a' },
      { kind: 'volume', who: 'a' },
    ])
    expect(summaryClauses([], [], 'a')).toEqual([])
  })
})
