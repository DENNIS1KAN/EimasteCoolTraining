import { describe, expect, it } from 'vitest'
import { MINI, at, mkCheer, mkLog, mkMember, mkWeight, squad } from '../../../lib/testing/fixtures'
import { setLang } from '../../../i18n'
import { memberStats } from '../../../lib/stats'
import { weightAccess, visibleStats } from './visibility'
import { NUDGE_COOLDOWN_MS, NUDGE_MAX, charCount, cheerLine, cleanNudgeText, lastNudgeAt, makeCheerBack, makeNudge, nudgeState } from './nudges'
import { kudosFor, reactors, toggleKudos } from './kudos'
import { categoryLeaders, mvps, standings, weekRange, withRanks } from './league'
import { defaultPair, resolvePair, rivalOf } from './pair'
import { lastActiveAt, programWeekDots } from './weekDots'
import { groupFeedByDay, kudosOwner, matchesFilter } from './feedGroups'
import { recentWorkouts, topLifts } from './lifts'
import { fmtMetric } from './metrics'

const START = '2026-03-23' // Monday; MINI trains Mon / Wed / Fri
const S = 'stelios'
const T = 'thanos'
const D = 'dennis'

const stelios = mkMember({ id: S, name: 'Stelios', programStart: START })
const thanos = mkMember({ id: T, name: 'Thanos', programStart: START, color: 'orange', settings: { unit: 'kg', machines: {}, weightVisibility: 'change' } })
const eleni = mkMember({ id: 'eleni', name: 'Eleni', programStart: START, color: 'green', settings: { unit: 'kg', machines: {}, weightVisibility: 'private' } })
const dennis = mkMember({ id: D, name: 'Dennis', role: 'coach', competes: false, programId: null, color: 'aqua' })

describe('weightAccess', () => {
  it('shows your own weight and everything to the coach', () => {
    expect(weightAccess(eleni, eleni)).toBe('exact')
    expect(weightAccess(eleni, dennis)).toBe('exact')
  })
  it('follows the member setting for squad mates', () => {
    expect(weightAccess(stelios, thanos)).toBe('exact')
    expect(weightAccess(thanos, stelios)).toBe('change')
    expect(weightAccess(eleni, stelios)).toBe('hidden')
    expect(weightAccess(eleni, null)).toBe('hidden')
  })
  it('hides weight and goal progress from stats when hidden', () => {
    const d = squad({ members: [eleni], weights: [mkWeight('eleni', '2026-03-23', 70), mkWeight('eleni', '2026-03-30', 69)] })
    const s = { ...memberStats(d, 'eleni', '2026-03-31'), goalProgress: 0.4 }
    expect(visibleStats(s, 'exact')).toBe(s)
    const hidden = visibleStats(s, 'hidden')
    expect(hidden.weight).toBeNull()
    expect(hidden.goalProgress).toBeNull()
  })
})

describe('nudges', () => {
  const now = at('2026-03-31', 20)
  it('rate limits one nudge per sender and recipient per 6 h', () => {
    const cheers = [
      mkCheer({ fromId: S, toId: T, kind: 'nudge', createdAt: now - 2 * 3600000 }),
      mkCheer({ fromId: S, toId: T, kind: 'nudge', createdAt: now - 30 * 3600000 }),
      mkCheer({ fromId: T, toId: S, kind: 'nudge', createdAt: now - 60000 }),
    ]
    expect(lastNudgeAt(cheers, S, T)).toBe(now - 2 * 3600000)
    const st = nudgeState(cheers, S, T, now)
    expect(st.canNudge).toBe(false)
    expect(st.readyAt).toBe(now - 2 * 3600000 + NUDGE_COOLDOWN_MS)
    expect(nudgeState(cheers, S, T, now + 4 * 3600000 + 1).canNudge).toBe(true)
    expect(nudgeState(cheers, D, T, now).canNudge).toBe(true)
    expect(nudgeState(cheers, S, S, now).canNudge).toBe(false)
  })
  it('ignores kudos, messages and replies for the limit', () => {
    const cheers = [
      mkCheer({ fromId: S, toId: T, kind: 'kudos', createdAt: now - 1000 }),
      mkCheer({ fromId: S, toId: T, kind: 'message', createdAt: now - 1000 }),
      mkCheer({ fromId: S, toId: T, kind: 'nudge', ref: 'cheer:abc', createdAt: now - 1000 }),
    ]
    expect(nudgeState(cheers, S, T, now).canNudge).toBe(true)
  })
  it('cleans custom text and caps it without splitting emoji', () => {
    expect(cleanNudgeText('  hi   there \n you ')).toBe('hi there you')
    const long = '💪'.repeat(NUDGE_MAX + 10)
    expect(charCount(cleanNudgeText(long))).toBe(NUDGE_MAX)
    expect(cleanNudgeText(long).endsWith('💪')).toBe(true)
  })
  it('builds nudges and cheer-backs', () => {
    const n = makeNudge({ id: 'x', fromId: S, toId: T, text: ' Time to train! ', emoji: '💪', now })
    expect(n).toMatchObject({ kind: 'nudge', fromId: S, toId: T, text: 'Time to train!', seenAt: null, ref: null })
    const back = makeCheerBack({ id: 'y', original: n, text: 'Right back at you', now: now + 5 })
    expect(back).toMatchObject({ fromId: T, toId: S, kind: 'nudge', ref: 'cheer:x', emoji: '💪' })
  })
  it('joins text and emoji once', () => {
    expect(cheerLine({ text: 'Time to train!', emoji: '💪' })).toBe('Time to train! 💪')
    expect(cheerLine({ text: 'Go 💪', emoji: '💪' })).toBe('Go 💪')
    expect(cheerLine({ text: '', emoji: '🔥' })).toBe('🔥')
  })
})

describe('kudos', () => {
  const item = 'workout:l1'
  const k = (fromId: string, emoji: string, t: number, ref = item) => mkCheer({ fromId, toId: S, kind: 'kudos', emoji, ref, createdAt: t })
  it('counts reactions per emoji, standard four first, one per person', () => {
    const cheers = [k(T, '🔥', 3), k(D, '🔥', 1), k(D, '🔥', 2), k(D, '🥇', 4), k(T, '💪', 5, 'workout:other')]
    const e = kudosFor(cheers, item, T)
    expect(e.map((x) => x.emoji)).toEqual(['🔥', '💪', '👏', '🏆', '🥇'])
    expect(e[0]).toMatchObject({ count: 2, fromIds: [D, T] })
    expect(e[0].mine?.fromId).toBe(T)
    expect(e[1].count).toBe(0)
    expect(e[4].count).toBe(1)
    expect(reactors(e, cheers)).toEqual([D, T])
  })
  it('toggles the viewer reaction and refuses self-kudos', () => {
    const cheers = [k(T, '🔥', 3)]
    const [fire, muscle] = kudosFor(cheers, item, T)
    expect(toggleKudos({ entry: fire, itemId: item, toId: S, viewerId: T, id: 'n', now: 9 })).toEqual({ type: 'remove', id: cheers[0].id })
    const add = toggleKudos({ entry: muscle, itemId: item, toId: S, viewerId: T, id: 'n', now: 9 })
    expect(add).toMatchObject({ type: 'put', row: { id: 'n', fromId: T, toId: S, kind: 'kudos', ref: item, emoji: '💪' } })
    expect(toggleKudos({ entry: muscle, itemId: item, toId: S, viewerId: S, id: 'n', now: 9 })).toBeNull()
  })
})

describe('league', () => {
  const logs = [
    mkLog({ member: S, week: 1, day: 0, doneAt: at('2026-03-23') }),
    mkLog({ member: S, week: 1, day: 1, doneAt: at('2026-03-25') }),
    mkLog({ member: T, week: 1, day: 0, doneAt: at('2026-03-24') }),
    mkLog({ member: T, week: 2, day: 0, doneAt: at('2026-03-30') }),
  ]
  const d = squad({ members: [stelios, thanos, dennis], logs })
  it('ranks points this week and all time', () => {
    const week = standings(d, [S, T], 'week', '2026-03-31')
    expect(week.map((r) => [r.memberId, r.points.total, r.rank])).toEqual([
      [T, 10, 1],
      [S, 0, 2],
    ])
    const all = standings(d, [S, T], 'all', '2026-03-31')
    expect(all.map((r) => r.rank)).toEqual([1, 1])
    expect(mvps(all)).toEqual([S, T])
    expect(mvps(week)).toEqual([T])
    expect(mvps(standings(d, [S], 'week', '2026-03-31'))).toEqual([])
  })
  it('computes the week range Monday to Sunday', () => {
    expect(weekRange('2026-03-31')).toEqual({ from: '2026-03-30', to: '2026-04-05' })
  })
  it('assigns competition ranks', () => {
    expect(withRanks([5, 5, 3, 1, 1], (x) => x).map((r) => r.rank)).toEqual([1, 1, 3, 4, 4])
  })
  it('finds category leaders and skips all-zero or missing categories', () => {
    const sS = memberStats(d, S, '2026-03-31')
    const sT = memberStats(d, T, '2026-03-31')
    const cats = categoryLeaders([sS, sT])
    const byKey = Object.fromEntries(cats.map((c) => [c.key, c]))
    expect(byKey.consistency.leaders).toEqual([S, T])
    expect(byKey.nutrition.leaders).toEqual([])
    expect(byKey.nutrition.value).toBeNull()
    expect(byKey.volumeWeek.leaders).toEqual([])
  })
})

describe('pairs', () => {
  const comps = [stelios, thanos, eleni]
  it('picks the closest competitor in points as rival', () => {
    expect(rivalOf(comps, stelios, { stelios: 100, thanos: 40, eleni: 90 })?.id).toBe('eleni')
    expect(rivalOf(comps, stelios)?.id).toBe(T)
    expect(rivalOf(comps, dennis)).toBeNull()
  })
  it('defaults to you vs rival, or the first two for the coach', () => {
    expect(defaultPair(comps, thanos)?.map((m) => m.id)).toEqual([T, S])
    expect(defaultPair(comps, dennis)?.map((m) => m.id)).toEqual([S, T])
    expect(defaultPair([stelios], stelios)).toBeNull()
  })
  it('resolves and repairs pairs from the URL', () => {
    expect(resolvePair(comps, dennis, 'eleni', 'thanos')?.map((m) => m.id)).toEqual(['eleni', T])
    expect(resolvePair(comps, stelios, null, null)?.map((m) => m.id)).toEqual([S, T])
    expect(resolvePair(comps, stelios, 'thanos', 'thanos')?.map((m) => m.id)).toEqual([T, S])
    expect(resolvePair(comps, stelios, 'nobody', 'stelios')?.map((m) => m.id)).toEqual([T, S])
    expect(resolvePair([stelios], stelios, null, null)).toBeNull()
  })
})

describe('programWeekDots', () => {
  it('marks done, missed, today and upcoming in the current program week', () => {
    const logs = [mkLog({ member: S, week: 2, day: 0, doneAt: at('2026-03-30') })]
    // Wed 1 Apr: week 2, day 1 is today
    const dots = programWeekDots(MINI, START, logs, '2026-04-01')
    expect(dots.map((x) => [x.label, x.state])).toEqual([
      ['U', 'done'],
      ['L', 'today'],
      ['F', 'upcoming'],
    ])
    const later = programWeekDots(MINI, START, logs, '2026-04-04')
    expect(later.map((x) => x.state)).toEqual(['done', 'missed', 'missed'])
  })
  it('previews week 1 before the start', () => {
    expect(programWeekDots(MINI, null, [], '2026-03-20').map((x) => x.state)).toEqual(['upcoming', 'upcoming', 'upcoming'])
    expect(programWeekDots(MINI, '2026-04-06', [], '2026-03-20').every((x) => x.week === 1 && x.state === 'upcoming')).toBe(true)
  })
})

describe('lastActiveAt', () => {
  it('takes the latest of logs, weigh-ins, check-ins and cheers sent', () => {
    const d = squad({
      logs: [mkLog({ member: S, week: 1, day: 0, doneAt: at('2026-03-23') })],
      weights: [mkWeight(S, '2026-03-25', 80)],
      cheers: [mkCheer({ fromId: S, toId: T, kind: 'nudge', createdAt: at('2026-03-26', 9) }), mkCheer({ fromId: T, toId: S, kind: 'nudge', createdAt: at('2026-03-29') })],
    })
    expect(lastActiveAt(d, S)).toBe(at('2026-03-26', 9))
    expect(lastActiveAt(d, 'nobody')).toBeNull()
  })
})

describe('feed helpers', () => {
  it('groups by local day, newest first', () => {
    const base = { memberId: S, emoji: '', text: '', cheerId: 'c', toId: T }
    const items = [
      { ...base, kind: 'nudge' as const, id: 'a', at: at('2026-03-31', 21) },
      { ...base, kind: 'nudge' as const, id: 'b', at: at('2026-03-31', 0, 30) },
      { ...base, kind: 'message' as const, id: 'c', at: at('2026-03-30', 23, 59) },
    ]
    const g = groupFeedByDay(items)
    expect(g.map((x) => [x.date, x.items.map((i) => i.id)])).toEqual([
      ['2026-03-31', ['a', 'b']],
      ['2026-03-30', ['c']],
    ])
    expect(matchesFilter(items[0], 'cheers')).toBe(true)
    expect(matchesFilter(items[0], 'workouts')).toBe(false)
    expect(kudosOwner(items[0])).toBe(S)
    expect(kudosOwner({ kind: 'plan', id: 'p', memberId: S, at: 1, planId: 'p', title: '', byId: D })).toBe(D)
  })
})

describe('topLifts / recentWorkouts', () => {
  it('ranks exercises by best e1RM and lists recent finished workouts', () => {
    const logs = [
      mkLog({ member: S, week: 1, day: 0, doneAt: at('2026-03-23'), ex: { 0: { sets: [['100', '5']] }, 1: { sets: [['60', '10']] } } }),
      mkLog({ member: S, week: 2, day: 0, doneAt: at('2026-03-30'), ex: { 0: { sets: [['105', '5']] } } }),
      mkLog({ member: S, week: 2, day: 1, done: false, doneAt: null, ex: { 0: { sets: [['140', '5']] } } }),
    ]
    const top = topLifts(logs, { [MINI.id]: MINI })
    expect(top.map((t) => t.name)).toEqual(['Squat', 'Bench Press', 'Row'])
    expect(top[1]).toMatchObject({ kg: 105, reps: 5, sessions: 2 })
    expect(recentWorkouts(logs).map((l) => l.week)).toEqual([2, 1])
  })
})

describe('fmtMetric', () => {
  it('formats each metric and dashes missing values', () => {
    setLang('en')
    expect(fmtMetric('consistency', 0.92)).toBe('92%')
    expect(fmtMetric('strength', 0.082)).toBe('+8.2%')
    expect(fmtMetric('volumeWeek', 18400)).toBe('18.4 t')
    expect(fmtMetric('points', 120)).toBe('120')
    expect(fmtMetric('goal', null)).toBe('—')
  })
})

describe('weightChangeTone', () => {
  it('rewards moving toward the goal', async () => {
    const { weightChangeTone, changeDir } = await import('./weight')
    expect(weightChangeTone(-1.5, 82, 79)).toBe('good')
    expect(weightChangeTone(1, 82, 79)).toBe('warn')
    expect(weightChangeTone(0.8, 72, 75)).toBe('good')
    expect(weightChangeTone(0.8, 72, null)).toBe('neutral')
    expect(weightChangeTone(0.01, 72, 75)).toBe('neutral')
    expect(changeDir(-0.3)).toBe('down')
    expect(changeDir(0)).toBe('flat')
  })
})
