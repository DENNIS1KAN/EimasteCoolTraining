import { describe, expect, it } from 'vitest'
import { DST_AUTUMN, DST_SPRING, MINI, at, meals, mkCheckin, mkCheer, mkLog, mkMember, mkPlan, mkWeight, squad } from '../testing/fixtures'
import type { Member, WorkoutLog } from '../../data/types'
import { addDays, fromISODate } from '../dates'
import { BADGES, earnedBadges, type BadgeId } from './badges'
import { programWorkouts } from './schedule'

const S = 'stelios'
const member = (p: Partial<Member> = {}) => mkMember({ id: S, programStart: '2026-03-23', ...p })
const badgeMap = (d: ReturnType<typeof squad>) => Object.fromEntries(earnedBadges(d, S).map((b) => [b.id, b.at])) as Partial<Record<BadgeId, number>>
const endOfDay = (date: string) => fromISODate(date).getTime() + 11 * 3600000

/** n (<= 6) done logs on consecutive days from `from` at 18:00, in MINI training order. */
function streakOfLogs(from: string, n: number): WorkoutLog[] {
  return programWorkouts(MINI)
    .slice(0, n)
    .map((r, i) => mkLog({ member: S, week: r.week, day: r.day, doneAt: at(addDays(from, i)) }))
}

describe('BADGES catalogue', () => {
  it('has unique ids and a tier for each', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length)
    for (const b of BADGES) expect(['bronze', 'silver', 'gold']).toContain(b.tier)
  })
})

describe('earnedBadges', () => {
  it('nothing for an unknown member or a member without data', () => {
    expect(earnedBadges(squad({}), S)).toEqual([])
    expect(earnedBadges(squad({ members: [member()] }), S)).toEqual([])
  })

  it('workout milestones, halfway and program completion at the moment they happened', () => {
    const logs = programWorkouts(MINI).map((r, i) => mkLog({ member: S, week: r.week, day: r.day, doneAt: at(addDays('2026-03-23', i * 2)) }))
    const b = badgeMap(squad({ members: [member()], logs }))
    expect(b['first-workout']).toBe(at('2026-03-23'))
    expect(b.halfway).toBe(at('2026-03-27')) // 3rd of 6
    expect(b['program-complete']).toBe(at('2026-04-02')) // 6th
    expect(b['workouts-10']).toBeUndefined()
  })

  it('ignores unfinished logs and logs of other programs for program badges', () => {
    const logs = [
      mkLog({ member: S, week: 1, day: 0, done: false, doneAt: null, ex: { 0: { sets: [['100', '5']] } } }),
      mkLog({ member: S, week: 1, day: 0, program: { ...MINI, id: 'other' }, doneAt: at('2026-03-23') }),
    ]
    const b = badgeMap(squad({ members: [member()], logs }))
    expect(b['first-workout']).toBe(at('2026-03-23'))
    expect(b.halfway).toBeUndefined()
  })

  it('perfect week: the earliest program week with all its workouts done, even if trained out of order', () => {
    const logs = [
      mkLog({ member: S, week: 2, day: 0, doneAt: at('2026-03-30') }),
      mkLog({ member: S, week: 2, day: 1, doneAt: at('2026-03-31') }),
      mkLog({ member: S, week: 2, day: 2, doneAt: at('2026-04-01') }),
      mkLog({ member: S, week: 1, day: 0, doneAt: at('2026-03-23') }),
      mkLog({ member: S, week: 1, day: 1, doneAt: at('2026-03-25') }),
      mkLog({ member: S, week: 1, day: 2, doneAt: at('2026-04-03') }), // week 1 completed last
    ]
    expect(badgeMap(squad({ members: [member()], logs }))['perfect-week']).toBe(at('2026-04-01'))
  })

  it('streak-4: four consecutive calendar weeks with 3+ workouts, dated at the 3rd workout of the 4th week', () => {
    const mondays = ['2026-03-16', '2026-03-23', '2026-03-30', '2026-04-06']
    const logs = mondays.flatMap((m, wi) =>
      [0, 2, 4].map((off, di) => mkLog({ member: S, week: 1, day: di, doneAt: at(addDays(m, off)), program: { ...MINI, id: `p${wi}` } })),
    )
    const b = badgeMap(squad({ members: [member()], logs }))
    expect(b['streak-4']).toBe(at('2026-04-10'))
    const broken = logs.filter((l) => l.programId !== 'p2')
    expect(badgeMap(squad({ members: [member()], logs: broken }))['streak-4']).toBeUndefined()
  })

  it('PR badges follow the PR timeline (the first session is never a PR)', () => {
    const logs = [
      mkLog({ member: S, week: 1, day: 0, doneAt: at('2026-03-23'), ex: { 0: { sets: [['100', '5']] } } }),
      mkLog({ member: S, week: 2, day: 0, doneAt: at('2026-03-30'), ex: { 0: { sets: [['105', '5']] } } }),
    ]
    const b = badgeMap(squad({ members: [member()], logs }))
    expect(b['first-pr']).toBe(at('2026-03-30'))
    expect(b['prs-10']).toBeUndefined()
    expect(badgeMap(squad({ members: [member()], logs: logs.slice(0, 1) }))['first-pr']).toBeUndefined()
  })

  it('ten tonnes in one session, also for a finished log without a finish time', () => {
    const sets: [string, string][] = Array.from({ length: 10 }, () => ['100', '10'])
    const heavy = mkLog({ member: S, week: 1, day: 0, doneAt: at('2026-03-23'), ex: { 0: { sets } } })
    expect(badgeMap(squad({ members: [member()], logs: [heavy] }))['ten-tonnes']).toBe(at('2026-03-23'))
    const noFinish = { ...heavy, doneAt: null, startedAt: at('2026-03-23', 17) }
    expect(badgeMap(squad({ members: [member()], logs: [noFinish] }))['ten-tonnes']).toBe(at('2026-03-23', 17))
    const light = mkLog({ member: S, week: 1, day: 0, doneAt: at('2026-03-23'), ex: { 0: { sets: sets.slice(1) } } })
    expect(badgeMap(squad({ members: [member()], logs: [light] }))['ten-tonnes']).toBeUndefined()
  })

  it('early bird before 08:00 and night owl from 22:00 local time, also on DST nights', () => {
    const logs = [
      mkLog({ member: S, week: 1, day: 0, doneAt: at(DST_AUTUMN, 3, 30) }),
      mkLog({ member: S, week: 1, day: 1, doneAt: at(DST_SPRING, 22, 0) }),
      mkLog({ member: S, week: 1, day: 2, doneAt: at('2026-03-20', 8, 0) }),
    ]
    const b = badgeMap(squad({ members: [member()], logs }))
    expect(b['early-bird']).toBe(at(DST_AUTUMN, 3, 30))
    expect(b['night-owl']).toBe(at(DST_SPRING, 22, 0))
    const none = badgeMap(squad({ members: [member()], logs: [logs[2]] }))
    expect(none['early-bird']).toBeUndefined()
    expect(none['night-owl']).toBeUndefined()
  })

  it('weigh-in-7: seven consecutive days (across DST), dated at the end of the 7th day', () => {
    const days = ['2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', DST_SPRING, '2026-03-30']
    const b = badgeMap(squad({ members: [member()], weights: days.map((d) => mkWeight(S, d, 80)) }))
    expect(b['weigh-in-7']).toBe(endOfDay('2026-03-30'))
    const gap = days.filter((d) => d !== '2026-03-27')
    expect(badgeMap(squad({ members: [member()], weights: gap.map((d) => mkWeight(S, d, 80)) }))['weigh-in-7']).toBeUndefined()
  })

  it("no weight badges while the weight is private (squad mates' phones can't read the weigh-ins)", () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays('2026-03-24', i))
    const weights = [mkWeight(S, '2026-03-01', 90), ...days.map((d) => mkWeight(S, d, 84))]
    const priv = (v: 'private' | 'change') => member({ goalWeightKg: 86, settings: { unit: 'kg', machines: {}, weightVisibility: v } })
    const shared = badgeMap(squad({ members: [priv('change')], weights }))
    expect(shared['weigh-in-7']).toBeDefined()
    expect(shared['goal-reached']).toBeDefined()
    const hidden = badgeMap(squad({ members: [priv('private')], weights }))
    expect(hidden['weigh-in-7']).toBeUndefined()
    expect(hidden['goal-reached']).toBeUndefined()
  })

  it('on-plan-7: seven consecutive on-plan days, scored against the plan each day was logged under', () => {
    const old = mkPlan({ id: 'old', memberId: S, startDate: '2026-03-01', meals: meals('a', 'b') })
    const cur = mkPlan({ id: 'cur', memberId: S, startDate: '2026-04-01', active: true, meals: meals('x', 'y') })
    const days = Array.from({ length: 7 }, (_, i) => addDays('2026-03-10', i))
    const checkins = days.map((d) => mkCheckin(S, d, { meals: ['a', 'b'], planId: 'old' }))
    const b = badgeMap(squad({ members: [member()], mealPlans: [old, cur], checkins }))
    expect(b['on-plan-7']).toBe(endOfDay('2026-03-16'))
    const six = checkins.slice(1)
    expect(badgeMap(squad({ members: [member()], mealPlans: [old, cur], checkins: six }))['on-plan-7']).toBeUndefined()
  })

  it('goal reached when the trend crosses a weight-loss goal', () => {
    const weights = [mkWeight(S, '2026-03-01', 90), ...Array.from({ length: 20 }, (_, i) => mkWeight(S, addDays('2026-03-02', i), 84))]
    const b = badgeMap(squad({ members: [member({ goalWeightKg: 86 })], weights }))
    // trend = 84 + 6 * 0.8^n <= 86 once 0.8^n <= 1/3 -> n = 5 -> 2026-03-06
    expect(b['goal-reached']).toBe(endOfDay('2026-03-06'))
  })

  it('goal reached for a weight-gain goal', () => {
    const weights = [mkWeight(S, '2026-03-01', 70), ...Array.from({ length: 20 }, (_, i) => mkWeight(S, addDays('2026-03-02', i), 74))]
    const b = badgeMap(squad({ members: [member({ goalWeightKg: 72 })], weights }))
    // trend = 74 - 4 * 0.8^n >= 72 once 0.8^n <= 0.5 -> n = 4 -> 2026-03-05
    expect(b['goal-reached']).toBe(endOfDay('2026-03-05'))
  })

  it('no goal badge for a noisy single dip, a tiny goal, or a single weigh-in', () => {
    const dip = [mkWeight(S, '2026-03-01', 90), mkWeight(S, '2026-03-02', 85), mkWeight(S, '2026-03-03', 90)]
    expect(badgeMap(squad({ members: [member({ goalWeightKg: 86 })], weights: dip }))['goal-reached']).toBeUndefined()
    const tiny = [mkWeight(S, '2026-03-01', 80), mkWeight(S, '2026-03-02', 79.5), mkWeight(S, '2026-03-03', 79)]
    expect(badgeMap(squad({ members: [member({ goalWeightKg: 79.8 })], weights: tiny }))['goal-reached']).toBeUndefined()
    expect(badgeMap(squad({ members: [member({ goalWeightKg: 80 })], weights: [mkWeight(S, '2026-03-01', 70)] }))['goal-reached']).toBeUndefined()
  })

  it('hype squad after giving 10 kudos (nudges do not count)', () => {
    const kudos = Array.from({ length: 10 }, (_, i) => mkCheer({ fromId: S, toId: 'thanos', kind: 'kudos', createdAt: at('2026-03-23', 8 + i) }))
    const nudge = mkCheer({ fromId: S, toId: 'thanos', kind: 'nudge', createdAt: at('2026-03-22') })
    expect(badgeMap(squad({ members: [member()], cheers: [nudge, ...kudos] }))['hype-squad']).toBe(at('2026-03-23', 17))
    expect(badgeMap(squad({ members: [member()], cheers: [nudge, ...kudos.slice(1)] }))['hype-squad']).toBeUndefined()
  })

  it('returns badges sorted by the time they were earned', () => {
    const logs = streakOfLogs('2026-03-23', 3)
    const weights = Array.from({ length: 7 }, (_, i) => mkWeight(S, addDays('2026-03-01', i), 80))
    const out = earnedBadges(squad({ members: [member()], logs, weights }), S)
    expect(out.map((b) => b.id)).toEqual(['weigh-in-7', 'first-workout', 'halfway', 'perfect-week'])
    for (let i = 1; i < out.length; i++) expect(out[i].at).toBeGreaterThanOrEqual(out[i - 1].at)
  })
})
