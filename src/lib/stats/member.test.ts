import { describe, expect, it } from 'vitest'
import { DST_AUTUMN, DST_SPRING, MINI, at, meals, mkCheckin, mkLog, mkMember, mkPlan, mkWeight, squad } from '../testing/fixtures'
import type { WorkoutLog } from '../../data/types'
import { addDays } from '../dates'
import {
  H2H_METRICS,
  POINTS,
  competitors,
  doneBetween,
  headToHead,
  logsOf,
  memberStats,
  metricValue,
  points,
  programOf,
  rankBy,
  sortedMembers,
  weekStreak,
  type MemberStats,
} from './member'

const START = '2026-03-23' // Monday; MINI trains Mon / Wed / Fri
const TODAY = '2026-03-31' // Tuesday of program week 2

const S = 'stelios'
const T = 'thanos'
const D = 'dennis'

function fixture() {
  const members = [
    mkMember({ id: S, name: 'Stelios', programStart: START, goalWeightKg: 85 }),
    mkMember({ id: T, name: 'Thanos', programStart: START, color: 'orange' }),
    mkMember({ id: D, name: 'Dennis', role: 'coach', competes: false, programId: null, color: 'aqua' }),
  ]
  const logs = [
    mkLog({ member: S, week: 1, day: 0, doneAt: at('2026-03-23'), ex: { 0: { sets: [['100', '5'], ['100', '5']] } } }),
    mkLog({ member: S, week: 1, day: 1, doneAt: at('2026-03-25'), ex: { 0: { sets: [['120', '5']] } } }),
    mkLog({ member: S, week: 1, day: 2, doneAt: at('2026-03-28'), ex: { 0: { sets: [['', '10']] }, 1: { sets: [['10', '15']] } } }),
    mkLog({ member: S, week: 2, day: 0, doneAt: at('2026-03-30', 7, 30), ex: { 0: { sets: [['105', '5']] } } }),
    mkLog({ member: S, week: 2, day: 1, done: false, doneAt: null, startedAt: at('2026-03-31', 18) }), // opened, nothing ticked
    mkLog({ member: T, week: 1, day: 0, doneAt: at('2026-03-24'), ex: { 0: { sets: [['80', '8']] } } }),
    mkLog({ member: T, week: 1, day: 1, doneAt: at('2026-03-26'), ex: { 0: { sets: [['100', '8']] } } }),
  ]
  const weights = [
    mkWeight(S, '2026-03-22', 90),
    mkWeight(S, '2026-03-25', 89.8),
    mkWeight(S, '2026-03-26', 89.5),
    mkWeight(S, '2026-03-30', 89.2),
    mkWeight(S, '2026-03-31', 89),
  ]
  const plan = mkPlan({ id: 'plan-s', memberId: S, startDate: '2026-03-30', active: true, meals: meals('b', 'l', 'd') })
  const checkins = [
    mkCheckin(S, '2026-03-30', { meals: ['b', 'l', 'd'], planId: plan.id }),
    mkCheckin(S, '2026-03-31', { rating: 'mostly', planId: plan.id }),
  ]
  return squad({ members, logs, weights, mealPlans: [plan], checkins })
}

describe('selectors', () => {
  const d = fixture()

  it('logsOf filters by member and optionally program', () => {
    expect(logsOf(d, S)).toHaveLength(5)
    expect(logsOf(d, S, 'other')).toHaveLength(0)
    expect(logsOf(d, 'nobody')).toEqual([])
  })

  it('sortedMembers puts athletes first by name, then coaches; competitors only those who compete', () => {
    expect(sortedMembers(d).map((m) => m.id)).toEqual([S, T, D])
    expect(competitors(d).map((m) => m.id)).toEqual([S, T])
  })

  it('programOf resolves the assigned program', () => {
    expect(programOf(d, d.members[S])?.id).toBe(MINI.id)
    expect(programOf(d, d.members[D])).toBeNull()
    expect(programOf(d, undefined)).toBeNull()
    expect(programOf(d, { ...d.members[S], programId: 'deleted' })).toBeNull()
  })
})

describe('doneBetween', () => {
  it('uses the local finish date, inclusive on both ends', () => {
    const logs = [
      mkLog({ week: 1, day: 0, doneAt: at('2026-03-28', 23, 59) }),
      mkLog({ week: 1, day: 1, doneAt: at(DST_SPRING, 0, 30) }),
      mkLog({ week: 1, day: 2, done: false, doneAt: null, updatedAt: at(DST_SPRING) }),
    ]
    expect(doneBetween(logs, DST_SPRING, DST_SPRING).map((l) => l.day)).toEqual([1])
    expect(doneBetween(logs, '2026-03-28', DST_SPRING)).toHaveLength(2)
    expect(doneBetween([], '2026-01-01', '2026-12-31')).toEqual([])
  })
})

describe('weekStreak', () => {
  /** n done workouts in the calendar week starting on Monday `monday`. */
  const week = (monday: string, n: number): WorkoutLog[] =>
    Array.from({ length: n }, (_, i) => mkLog({ week: 1, day: i, doneAt: at(addDays(monday, i), 12), member: `${monday}-${i}` }))

  it('counts consecutive calendar weeks with 3+ workouts, including the current week once it qualifies', () => {
    const logs = [...week('2026-03-16', 3), ...week('2026-03-23', 4), ...week('2026-03-30', 3)]
    expect(weekStreak(logs, '2026-04-02')).toBe(3)
  })

  it('an unfinished current week does not break the streak yet', () => {
    const logs = [...week('2026-03-16', 3), ...week('2026-03-23', 3), ...week('2026-03-30', 1)]
    expect(weekStreak(logs, '2026-04-02')).toBe(2)
  })

  it('a thin week breaks it', () => {
    const logs = [...week('2026-03-09', 3), ...week('2026-03-16', 2), ...week('2026-03-23', 3)]
    expect(weekStreak(logs, '2026-03-30')).toBe(1)
    expect(weekStreak(logs, '2026-04-06')).toBe(0) // last week (03-30) had none
  })

  it('weeks containing a DST switch are ordinary weeks (Sunday workouts count for the week they end)', () => {
    const logs = [
      ...week('2026-03-16', 3),
      mkLog({ week: 1, day: 0, doneAt: at('2026-03-27') }),
      mkLog({ week: 1, day: 1, doneAt: at('2026-03-28') }),
      mkLog({ week: 1, day: 2, doneAt: at(DST_SPRING, 23, 30) }),
      mkLog({ week: 2, day: 0, doneAt: at('2026-10-23'), member: 'x' }),
      mkLog({ week: 2, day: 1, doneAt: at('2026-10-24'), member: 'x' }),
      mkLog({ week: 2, day: 2, doneAt: at(DST_AUTUMN, 3, 30), member: 'x' }),
    ]
    expect(weekStreak(logs, '2026-03-30')).toBe(2)
    expect(weekStreak(logs, '2026-10-26')).toBe(1)
  })

  it('ignores unfinished logs and honours minPerWeek', () => {
    const logs = [...week('2026-03-23', 2), mkLog({ week: 2, day: 0, done: false, doneAt: null, updatedAt: at('2026-03-26') })]
    expect(weekStreak(logs, '2026-03-30')).toBe(0)
    expect(weekStreak(logs, '2026-03-30', 2)).toBe(1)
    expect(weekStreak([], '2026-03-30')).toBe(0)
  })
})

describe('points', () => {
  it('all-time: workouts, PRs, perfect weeks, weigh-ins and on-plan days', () => {
    const p = points(fixture(), S)
    expect(p).toEqual({
      workouts: 4 * POINTS.workout,
      prs: 1 * POINTS.pr,
      perfectWeeks: 1 * POINTS.perfectWeek,
      weighIns: 5 * POINTS.weighIn,
      onPlanDays: 1 * POINTS.onPlanDay,
      total: 40 + 5 + 15 + 5 + 2,
    })
  })

  it('within a range, a perfect week counts in the week its last workout was finished', () => {
    const d = fixture()
    expect(points(d, S, '2026-03-30', '2026-04-05')).toMatchObject({ workouts: 10, prs: 5, perfectWeeks: 0, weighIns: 2, onPlanDays: 2, total: 19 })
    expect(points(d, S, '2026-03-23', '2026-03-29')).toMatchObject({ workouts: 30, prs: 0, perfectWeeks: 15, weighIns: 2, onPlanDays: 0 })
    expect(points(d, S, '2026-03-28', '2026-03-28').perfectWeeks).toBe(15)
    expect(points(d, S, '2026-03-27', '2026-03-27').perfectWeeks).toBe(0)
  })

  it('is all zero for a member with no data', () => {
    expect(points(fixture(), D)).toEqual({ workouts: 0, prs: 0, perfectWeeks: 0, weighIns: 0, onPlanDays: 0, total: 0 })
    expect(points(fixture(), 'ghost').total).toBe(0)
  })

  it('counts a weigh-in day once', () => {
    const d = fixture()
    d.weights['dup'] = { ...mkWeight(S, '2026-03-31', 88.9), id: 'dup' }
    expect(points(d, S).weighIns).toBe(5)
  })

  it('past on-plan days keep their points when the coach issues a new plan', () => {
    const d = fixture()
    d.mealPlans['plan-s'] = { ...d.mealPlans['plan-s'], active: false }
    d.mealPlans['plan-2'] = mkPlan({ id: 'plan-2', memberId: S, startDate: '2026-04-06', active: true, meals: meals('x', 'y') })
    expect(points(d, S, '2026-03-30', '2026-03-30').onPlanDays).toBe(POINTS.onPlanDay)
  })
})

describe('points and weight privacy', () => {
  it('weigh-ins earn points only while the weight is shared with the squad', () => {
    const d = fixture()
    const vis = (v: 'exact' | 'change' | 'private') => {
      d.members[S] = { ...d.members[S], settings: { ...d.members[S].settings, weightVisibility: v } }
      return points(d, S)
    }
    expect(vis('exact').weighIns).toBe(5 * POINTS.weighIn)
    expect(vis('change').weighIns).toBe(5 * POINTS.weighIn)
    const priv = vis('private')
    expect(priv.weighIns).toBe(0)
    expect(priv.total).toBe(points(fixture(), S).total - 5 * POINTS.weighIn)
  })

  it("gives every phone the same standings: a private member's points don't depend on the weigh-in rows", () => {
    const d = fixture()
    d.members[S] = { ...d.members[S], settings: { ...d.members[S].settings, weightVisibility: 'private' } }
    const hidden = { ...d, weights: {} } // what a squad mate's phone receives
    expect(points(hidden, S)).toEqual(points(d, S))
  })
})

describe('memberStats', () => {
  it('summarises an athlete mid-program', () => {
    const s = memberStats(fixture(), S, TODAY)
    expect(s).toMatchObject({
      memberId: S,
      programWeek: 2,
      workoutsDone: 4,
      workoutsTotal: 6,
      weekStreak: 1,
      thisWeek: { done: 1, target: 3 },
      volumeWeekKg: 525,
      volumeTotalKg: 1000 + 600 + 150 + 525,
      prs30d: 1,
      lastWorkoutAt: at('2026-03-30', 7, 30),
      nextWorkout: { week: 2, day: 1 },
      adherence14: 0.75,
      adherence14Days: 2,
    })
    expect(s.program?.id).toBe(MINI.id)
    expect(s.schedule).toMatchObject({ dueBeforeToday: 4, done: 4, behindBy: 0, today: null, consistency: 1 })
    expect(s.prs.map((p) => p.exercise)).toEqual(['Bench Press'])
    expect(s.strengthGainPct).toBeCloseTo(0.05, 10)
    expect(s.weight).toMatchObject({ startDate: '2026-03-22', startKg: 90, latestKg: 89 })
    expect(s.goalProgress).toBeCloseTo((s.weight!.trendKg - 90) / (85 - 90), 10)
    expect(s.points.total).toBe(19)
  })

  it('a member without a program, weights or plan gets empty stats', () => {
    const s = memberStats(fixture(), D, TODAY)
    expect(s).toMatchObject({
      program: null,
      programWeek: 0,
      workoutsDone: 0,
      workoutsTotal: 0,
      schedule: null,
      nextWorkout: null,
      thisWeek: { done: 0, target: 5 },
      weight: null,
      goalProgress: null,
      adherence14: null,
      adherence14Days: 0,
      mealPlan: null,
      strengthGainPct: null,
      lastWorkoutAt: null,
    })
  })

  it('does not crash for an unknown member id', () => {
    expect(memberStats(fixture(), 'ghost', TODAY)).toMatchObject({ program: null, workoutsDone: 0 })
  })

  it('a program not started yet: week 0, nothing due', () => {
    const d = fixture()
    d.members[T] = { ...d.members[T], programStart: '2026-04-06' }
    const s = memberStats(d, T, TODAY)
    expect(s.programWeek).toBe(0)
    expect(s.schedule).toMatchObject({ started: false, dueBeforeToday: 0, consistency: null })
  })

  it('14-day adherence leaves an open today out (same rule as the Fuel page)', () => {
    const d = fixture()
    d.checkins[`${S}__${TODAY}`] = { ...d.checkins[`${S}__${TODAY}`], rating: null, meals: ['b'] }
    const s = memberStats(d, S, TODAY)
    expect(s.adherence14).toBe(1) // only 03-30 (all meals) counts
    expect(s.adherence14Days).toBe(1)
  })

  it('a plan starting today has no adherence yet instead of 0%', () => {
    const d = fixture()
    d.mealPlans['plan-s'] = { ...d.mealPlans['plan-s'], startDate: TODAY }
    delete d.checkins[`${S}__${TODAY}`]
    const s = memberStats(d, S, TODAY)
    expect(s.adherence14).toBeNull()
    expect(s.adherence14Days).toBe(0)
    expect(s.mealPlan?.id).toBe('plan-s') // "no number yet", not "no plan"
  })

  it('issuing a new plan keeps the 14-day adherence', () => {
    const d = fixture()
    const before = memberStats(d, S, TODAY)
    d.mealPlans['plan-s'] = { ...d.mealPlans['plan-s'], active: false }
    d.mealPlans['plan-2'] = mkPlan({ id: 'plan-2', memberId: S, startDate: TODAY, active: true, meals: meals('x', 'y') })
    const after = memberStats(d, S, TODAY)
    expect(after.adherence14).toBe(before.adherence14)
    expect(after.adherence14Days).toBe(2)
  })

  it('nutrition adherence is null before the meal plan starts', () => {
    const d = fixture()
    d.mealPlans['plan-s'] = { ...d.mealPlans['plan-s'], startDate: '2026-04-06' }
    expect(memberStats(d, S, TODAY).adherence14).toBeNull()
  })
})

describe('headToHead', () => {
  const d = fixture()
  const s = memberStats(d, S, TODAY)
  const t = memberStats(d, T, TODAY)

  it('compares every metric, higher is better', () => {
    const h = headToHead(s, t)
    const w = Object.fromEntries(h.rows.map((r) => [r.key, r.winner]))
    expect(w).toEqual({
      points: 'a',
      workouts: 'a',
      consistency: 'a',
      streak: 'a',
      volumeWeek: 'a',
      prs: 'a',
      strength: null, // Thanos has no exercise with two sessions
      goal: null, // Thanos has no goal / weigh-ins
      nutrition: null, // Thanos has no plan
    })
    expect(h.a).toBe(6)
    expect(h.b).toBe(0)
    expect(h.rows.find((r) => r.key === 'consistency')).toMatchObject({ a: 1, b: 0.5 })
  })

  it('the order of the members flips the result', () => {
    const h = headToHead(t, s)
    expect(h.a).toBe(0)
    expect(h.b).toBe(6)
  })

  it('ties: equal counts, and ratios within half a percentage point', () => {
    const withConsistency = (x: MemberStats, c: number): MemberStats => ({ ...x, schedule: { ...x.schedule!, consistency: c } })
    const h = headToHead(withConsistency(s, 0.5), withConsistency(t, 0.504), ['consistency', 'streak'])
    expect(h.rows.map((r) => r.winner)).toEqual(['tie', 'a'])
    expect(headToHead(withConsistency(s, 0.5), withConsistency(t, 0.506), ['consistency']).rows[0].winner).toBe('b')
    const same = headToHead(s, s)
    expect(same.a).toBe(0)
    expect(same.b).toBe(0)
    expect(same.rows.filter((r) => r.winner === 'tie').map((r) => r.key)).toEqual(['points', 'workouts', 'consistency', 'streak', 'volumeWeek', 'prs', 'strength', 'goal', 'nutrition'])
  })

  it('metricValue maps every key', () => {
    expect(H2H_METRICS.map((k) => metricValue(s, k))).toEqual([
      19,
      4,
      1,
      1,
      525,
      1,
      s.strengthGainPct,
      s.goalProgress,
      0.75,
    ])
  })
})

describe('rankBy', () => {
  const d = fixture()
  const s = memberStats(d, S, TODAY)
  const t = memberStats(d, T, TODAY)

  it('ranks best first and puts members without a value last', () => {
    const r = rankBy([t, s], 'nutrition')
    expect(r).toEqual([
      { memberId: S, value: 0.75, rank: 1 },
      { memberId: T, value: null, rank: 2 },
    ])
  })

  it('equal values share a rank (1, 1, 3)', () => {
    const clone = { ...s, memberId: 'clone' }
    expect(rankBy([t, s, clone], 'workouts').map((x) => [x.memberId, x.rank])).toEqual([
      [S, 1],
      ['clone', 1],
      [T, 3],
    ])
  })

  it('handles an empty list', () => {
    expect(rankBy([], 'points')).toEqual([])
  })
})
