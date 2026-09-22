import { describe, expect, it } from 'vitest'
import { at, mkCheer, mkLog, mkMember, mkPlan, mkWeight, squad } from '../testing/fixtures'
import { fromISODate } from '../dates'
import { buildFeed, reactionsFor, unseenCheers, type FeedItem } from './feed'

const S = 'stelios'
const T = 'thanos'
const D = 'dennis'

function fixture() {
  const members = [
    mkMember({ id: S, settings: { unit: 'kg', machines: {}, weightVisibility: 'change' } }),
    mkMember({ id: T, settings: { unit: 'kg', machines: {}, weightVisibility: 'private' } }),
    mkMember({ id: D, role: 'coach', competes: false, programId: null }),
  ]
  const logs = [
    mkLog({ member: S, week: 1, day: 0, doneAt: at('2026-03-23', 18), feel: 4, note: 'Solid', ex: { 0: { sets: [['100', '5']] } } }),
    mkLog({ member: S, week: 1, day: 1, doneAt: at('2026-03-25', 18), ex: { 0: { sets: [['120', '5']] } } }),
    mkLog({ member: S, week: 2, day: 0, doneAt: at('2026-03-30', 7, 30), ex: { 0: { sets: [['105', '5']] } } }),
    mkLog({ member: S, week: 2, day: 1, done: false, doneAt: null, startedAt: at('2026-04-01', 18), ex: { 0: { sets: [['125', '5']] } } }),
    mkLog({ member: T, week: 1, day: 0, doneAt: at('2026-03-24', 19), ex: { 0: { sets: [['80', '8']] } } }),
  ]
  const weights = [
    mkWeight(S, '2026-03-20', 90.4),
    mkWeight(S, '2026-03-22', 90),
    mkWeight(S, '2026-03-24', 89.8),
    mkWeight(S, '2026-03-26', 89.5),
    mkWeight(S, '2026-04-08', 88.5), // no weigh-in in the week of 03-30
    mkWeight(T, '2026-03-24', 100),
  ]
  const cheers = [
    mkCheer({ id: 'k1', fromId: T, toId: S, kind: 'kudos', emoji: '🔥', ref: `workout:${logs[2].id}`, createdAt: at('2026-03-30', 9) }),
    mkCheer({ id: 'k2', fromId: D, toId: S, kind: 'kudos', emoji: '💪', ref: `workout:${logs[2].id}`, createdAt: at('2026-03-30', 8) }),
    mkCheer({ id: 'k3', fromId: D, toId: S, kind: 'kudos', emoji: '🔥', ref: `workout:${logs[2].id}`, createdAt: at('2026-03-30', 10) }),
    mkCheer({ id: 'n1', fromId: S, toId: T, kind: 'nudge', emoji: '👀', text: 'Gym?', createdAt: at('2026-03-27', 10) }),
    mkCheer({ id: 'm1', fromId: D, toId: S, kind: 'message', emoji: '', text: 'Nice week', createdAt: at('2026-03-29', 20), seenAt: at('2026-03-29', 21) }),
  ]
  const mealPlans = [mkPlan({ id: 'plan-s', memberId: S, startDate: '2026-03-29', title: 'Cut', createdBy: D })]
  return { d: squad({ members, logs, weights, cheers, mealPlans }), logs }
}

const kinds = (items: FeedItem[]) => items.map((i) => i.id)

describe('buildFeed', () => {
  it('is newest first and has stable ids', () => {
    const feed = buildFeed(fixture().d)
    for (let i = 1; i < feed.length; i++) expect(feed[i - 1].at).toBeGreaterThanOrEqual(feed[i].at)
    expect(new Set(feed.map((i) => i.id)).size).toBe(feed.length)
  })

  it('lists finished workouts with day name, summary, PRs, feel and note; unfinished ones are left out', () => {
    const { d, logs } = fixture()
    const workouts = buildFeed(d).filter((i) => i.kind === 'workout')
    expect(workouts.map((w) => w.id)).toEqual([`workout:${logs[2].id}`, `workout:${logs[1].id}`, `workout:${logs[4].id}`, `workout:${logs[0].id}`])
    const first = workouts.find((w) => w.id === `workout:${logs[0].id}`)!
    expect(first).toMatchObject({ memberId: S, dayName: 'Upper', week: 1, day: 0, feel: 4, note: 'Solid', prs: [], at: at('2026-03-23', 18) })
    expect(first.kind === 'workout' && first.summary.volumeKg).toBe(500)
    const pr = workouts.find((w) => w.id === `workout:${logs[2].id}`)!
    expect(pr.kind === 'workout' && pr.prs.map((p) => p.exercise)).toEqual(['Bench Press'])
  })

  it("summarises weigh-ins as one item per week: the week's last one and the change vs. the week before", () => {
    const weighins = buildFeed(fixture().d).filter((i) => i.kind === 'weighin')
    expect(weighins.map((w) => (w.kind === 'weighin' ? [w.weekStart, w.date, w.kg, w.changeKg] : null))).toEqual([
      ['2026-04-06', '2026-04-08', 88.5, null], // judgement call: a skipped week means no change is shown
      ['2026-03-23', '2026-03-26', 89.5, -0.5],
      ['2026-03-16', '2026-03-22', 90, null],
    ])
    expect(weighins[0].at).toBe(fromISODate('2026-04-08').getTime())
    expect(weighins[1].id).toBe(`weighin:${S}:2026-03-23`)
  })

  it('leaves out weigh-ins of members who keep their weight private', () => {
    expect(buildFeed(fixture().d).some((i) => i.kind === 'weighin' && i.memberId === T)).toBe(false)
  })

  it('includes badges, nudges, messages and new plans, but not kudos (those are reactions)', () => {
    const feed = buildFeed(fixture().d)
    expect(feed.find((i) => i.id === `badge:${S}:first-workout`)?.at).toBe(at('2026-03-23', 18))
    expect(feed.find((i) => i.id === `badge:${S}:early-bird`)?.at).toBe(at('2026-03-30', 7, 30))
    expect(feed.find((i) => i.id === 'cheer:n1')).toMatchObject({ kind: 'nudge', memberId: S, toId: T, text: 'Gym?', cheerId: 'n1' })
    expect(feed.find((i) => i.id === 'cheer:m1')).toMatchObject({ kind: 'message', memberId: D, toId: S })
    expect(feed.find((i) => i.id === 'plan:plan-s')).toMatchObject({ kind: 'plan', memberId: S, byId: D, title: 'Cut' })
    expect(feed.some((i) => i.id.startsWith('cheer:k'))).toBe(false)
  })

  it('filters by member: their own items plus cheers sent or received', () => {
    const feed = buildFeed(fixture().d, { memberId: T })
    expect(feed.every((i) => i.memberId === T || (i.kind === 'nudge' && i.toId === T))).toBe(true)
    expect(kinds(feed)).toContain('cheer:n1')
    expect(kinds(feed)).not.toContain('cheer:m1')
    expect(kinds(feed)).not.toContain('plan:plan-s')
  })

  it('honours since and limit', () => {
    const { d } = fixture()
    const since = at('2026-03-29', 0)
    const recent = buildFeed(d, { since })
    expect(recent.length).toBeGreaterThan(0)
    expect(recent.every((i) => i.at >= since)).toBe(true)
    const top2 = buildFeed(d, { limit: 2 })
    expect(top2).toEqual(buildFeed(d).slice(0, 2))
  })

  it('is empty for an empty squad', () => {
    expect(buildFeed(squad({}))).toEqual([])
  })
})

describe('reactionsFor', () => {
  it('groups kudos on an item by emoji in time order', () => {
    const { d, logs } = fixture()
    expect(reactionsFor(d.cheers, `workout:${logs[2].id}`)).toEqual({ '💪': [D], '🔥': [T, D] })
    expect(reactionsFor(d.cheers, 'workout:nothing')).toEqual({})
  })
})

describe('unseenCheers', () => {
  it('lists unseen nudges/messages addressed to the member, newest first (kudos are reactions, not inbox items)', () => {
    const { d } = fixture()
    expect(unseenCheers(d.cheers, S).map((c) => c.kind)).not.toContain('kudos')
    expect(unseenCheers(d.cheers, T).map((c) => c.id)).toEqual(['n1'])
    expect(unseenCheers(d.cheers, D)).toEqual([])
  })
})
