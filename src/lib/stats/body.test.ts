import { describe, expect, it } from 'vitest'
import { DST_AUTUMN, DST_SPRING, mkWeight } from '../testing/fixtures'
import { addDays } from '../dates'
import { goalProgress, weighInStreak, weightSeries, weightStats } from './body'

const W = (date: string, kg: number) => mkWeight('stelios', date, kg)
/** One weigh-in per day starting at `from`, following f(dayIndex). */
const daily = (from: string, days: number, f: (i: number) => number) => Array.from({ length: days }, (_, i) => W(addDays(from, i), f(i)))

describe('weightSeries', () => {
  it('is empty without data', () => {
    expect(weightSeries([])).toEqual([])
  })

  it('sorts by date, drops non-positive weights and starts the trend at the first weigh-in', () => {
    const s = weightSeries([W('2026-01-03', 81), W('2026-01-01', 80), W('2026-01-02', 0), W('2026-01-04', -1)])
    expect(s.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-03'])
    expect(s[0].trendKg).toBe(80)
  })

  it('smooths 10% per day and weighs a gap as several days', () => {
    const s = weightSeries([W('2026-01-01', 80), W('2026-01-02', 81), W('2026-01-05', 81)])
    expect(s[1].trendKg).toBeCloseTo(80.1, 10)
    // 3-day gap: alpha = 1 - 0.9^3 = 0.271
    expect(s[2].trendKg).toBeCloseTo(80.1 + 0.271 * 0.9, 10)
  })

  it('counts calendar days across DST, not 23/25 hour periods', () => {
    const s = weightSeries([W('2026-03-28', 80), W('2026-03-30', 82), W('2026-10-24', 80), W('2026-10-26', 82)])
    const alpha2 = 1 - 0.81
    expect(s[1].trendKg).toBeCloseTo(80 + alpha2 * 2, 10)
  })
})

describe('weightStats', () => {
  it('is null without weigh-ins', () => {
    expect(weightStats([])).toBeNull()
    expect(weightStats([W('2026-01-01', 0)])).toBeNull()
  })

  it('a single weigh-in has no change and no rate', () => {
    expect(weightStats([W('2026-01-01', 80)])).toMatchObject({ startKg: 80, latestKg: 80, trendKg: 80, changeKg: 0, changePct: 0, weeklyRateKg: null, entries: 1 })
  })

  it('without `since` the start is the first weigh-in', () => {
    const s = weightStats([W('2026-01-01', 90), W('2026-01-02', 88), W('2026-01-03', 91)])!
    expect(s).toMatchObject({ startDate: '2026-01-01', startKg: 90, latestDate: '2026-01-03', latestKg: 91, lowestKg: 88, highestKg: 91, entries: 3 })
    expect(s.changeKg).toBeCloseTo(s.trendKg - 90, 10)
  })

  it('starts from the weigh-in the day before the program when that is the closest', () => {
    const entries = [W('2026-03-01', 95), W('2026-03-22', 90), W('2026-03-30', 89)]
    expect(weightStats(entries, '2026-03-23')!.startDate).toBe('2026-03-22')
  })

  it('starts from the first weigh-in after `since` when the earlier one is older than 14 days or farther away', () => {
    expect(weightStats([W('2026-03-01', 95), W('2026-03-24', 90)], '2026-03-23')!.startDate).toBe('2026-03-24')
    expect(weightStats([W('2026-03-13', 95), W('2026-03-25', 90)], '2026-03-23')!.startDate).toBe('2026-03-25')
    // equally far: prefer the one inside the program
    expect(weightStats([W('2026-03-21', 95), W('2026-03-25', 90)], '2026-03-23')!.startDate).toBe('2026-03-25')
    // window statistics only cover the program
    expect(weightStats([W('2026-03-01', 100), W('2026-03-24', 90), W('2026-03-25', 91)], '2026-03-23')).toMatchObject({ highestKg: 91, entries: 2 })
  })

  it('when every weigh-in is before `since`, the latest one is the start (judgement call: no data yet)', () => {
    const s = weightStats([W('2026-01-01', 90), W('2026-01-10', 88)], '2026-03-23')!
    expect(s).toMatchObject({ startDate: '2026-01-10', entries: 1 })
  })

  it('weekly rate follows the trend of the last 4 weeks, in both directions', () => {
    const losing = weightStats(daily('2026-01-01', 60, (i) => 90 - 0.1 * i), null, '2026-03-01')!
    expect(losing.weeklyRateKg).toBeCloseTo(-0.7, 1)
    const gaining = weightStats(daily('2026-01-01', 60, (i) => 70 + 0.05 * i))!
    expect(gaining.weeklyRateKg).toBeCloseTo(0.35, 1)
  })

  it('weekly rate works with sparse weigh-ins (gaps) and across DST', () => {
    const entries = [W('2026-03-20', 90), W('2026-03-27', 89.3), W(DST_SPRING, 89.1), W('2026-04-03', 88.6), W('2026-04-10', 87.9)]
    const s = weightStats(entries)!
    expect(s.weeklyRateKg).toBeLessThan(-0.3)
    expect(s.entries).toBe(5)
  })

  it('weekly rate is null with under 5 days of recent data or when the last weigh-in is old', () => {
    expect(weightStats(daily('2026-01-01', 4, (i) => 80 - i))!.weeklyRateKg).toBeNull()
    expect(weightStats(daily('2026-01-01', 30, (i) => 80 - 0.1 * i), null, '2026-06-01')!.weeklyRateKg).toBeNull()
  })

  it('works around the autumn DST switch', () => {
    const s = weightStats(daily('2026-10-20', 10, () => 80), '2026-10-19', DST_AUTUMN)!
    expect(s).toMatchObject({ startDate: '2026-10-20', changeKg: 0, entries: 10 })
    expect(s.weeklyRateKg).toBeCloseTo(0, 10)
  })
})

describe('goalProgress', () => {
  it('is null without a goal', () => {
    expect(goalProgress(90, 85, null)).toBeNull()
    expect(goalProgress(90, 85, Number.NaN)).toBeNull()
  })

  it('works for a weight-loss goal', () => {
    expect(goalProgress(90, 85, 80)).toBeCloseTo(0.5, 10)
    expect(goalProgress(90, 80, 80)).toBeCloseTo(1, 10)
    expect(goalProgress(90, 78, 80)).toBeCloseTo(1.2, 10) // overshoot
    expect(goalProgress(90, 92, 80)).toBeCloseTo(-0.2, 10) // moving away
  })

  it('works for a weight-gain goal', () => {
    expect(goalProgress(70, 72.5, 75)).toBeCloseTo(0.5, 10)
    expect(goalProgress(70, 69, 75)).toBeCloseTo(-0.2, 10)
  })

  it('a maintenance goal (goal = start) is 1 while within 0.3 kg, else 0', () => {
    expect(goalProgress(80, 80.2, 80)).toBe(1)
    expect(goalProgress(80, 81, 80)).toBe(0)
    expect(goalProgress(80, 80.02, 80.03)).toBe(1)
  })
})

describe('weighInStreak', () => {
  const dates = ['2026-03-26', '2026-03-27', '2026-03-28', DST_SPRING, '2026-03-30']
  const entries = dates.map((d) => W(d, 80))

  it('counts consecutive days ending today, across DST', () => {
    expect(weighInStreak(entries, '2026-03-30')).toBe(5)
  })

  it('still counts when today is not logged yet, but not after a missed day', () => {
    expect(weighInStreak(entries, '2026-03-31')).toBe(5)
    expect(weighInStreak(entries, '2026-04-01')).toBe(0)
  })

  it('breaks on gaps and is 0 without data', () => {
    expect(weighInStreak(entries.filter((e) => e.date !== '2026-03-28'), '2026-03-30')).toBe(2)
    expect(weighInStreak([], '2026-03-30')).toBe(0)
  })
})
