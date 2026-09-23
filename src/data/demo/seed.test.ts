import { describe, expect, it } from 'vitest'
import type { Snapshot } from '../types'
import { addDays, diffDays, isoFromMs, startOfWeek, type ISODate } from '../../lib/dates'
import { dailyId, logId } from '../../lib/ids'
import {
  buildFeed,
  currentPlan,
  earnedBadges,
  headToHead,
  memberStats,
  personalRecords,
  programWeekOn,
  recentAdherence,
  unseenCheers,
  workoutOn,
  type SquadData,
} from '../../lib/stats'
import { BTS_PROGRAM } from '../programs'
import { createDemoSnapshot, DEMO_IDS } from './seed'

const byId = <T extends { id: string }>(rows: T[]) => Object.fromEntries(rows.map((r) => [r.id, r]))

function squad(s: Snapshot): SquadData {
  return {
    members: byId(s.members),
    programs: { [BTS_PROGRAM.id]: BTS_PROGRAM, ...byId(s.programs) },
    logs: byId(s.logs),
    weights: byId(s.weights),
    mealPlans: byId(s.mealPlans),
    checkins: byId(s.checkins),
    cheers: byId(s.cheers),
  }
}

/** Local end of a calendar day (ms). */
const endOf = (d: ISODate) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day, 23, 59, 59, 999).getTime()
}

/** Every timestamp (ms) in a snapshot, labelled for error messages. */
function timestamps(s: Snapshot): [string, number][] {
  const out: [string, number][] = []
  const add = (label: string, v: number | null | undefined) => {
    if (v != null) out.push([label, v])
  }
  for (const m of s.members) {
    add(`member ${m.id} updatedAt`, m.updatedAt)
    add(`member ${m.id} coachNoteAt`, m.coachNoteAt)
  }
  for (const l of s.logs) {
    add(`log ${l.id} startedAt`, l.startedAt)
    add(`log ${l.id} doneAt`, l.doneAt)
    add(`log ${l.id} updatedAt`, l.updatedAt)
    for (const [k, e] of Object.entries(l.ex)) for (const set of e.sets) add(`log ${l.id} ex ${k} set`, set.at)
  }
  for (const w of s.weights) add(`weight ${w.id}`, w.updatedAt)
  for (const p of s.mealPlans) {
    add(`plan ${p.id} createdAt`, p.createdAt)
    add(`plan ${p.id} updatedAt`, p.updatedAt)
  }
  for (const c of s.checkins) add(`checkin ${c.id}`, c.updatedAt)
  for (const c of s.cheers) {
    add(`cheer ${c.id} createdAt`, c.createdAt)
    add(`cheer ${c.id} seenAt`, c.seenAt)
    add(`cheer ${c.id} updatedAt`, c.updatedAt)
  }
  return out
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// A full week (every weekday variant) plus dates across a year boundary and both DST switches.
const WEEK = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']
const TODAYS = [...WEEK, '2027-01-04', '2025-03-30', '2026-04-08', '2026-11-05']

const { stelios: S, thanos: T, dennis: D } = DEMO_IDS

describe.each(TODAYS)('createDemoSnapshot(%s)', (today) => {
  const snap = createDemoSnapshot(today)
  const d = squad(snap)
  const start = addDays(startOfWeek(today), -14)
  const sStats = memberStats(d, S, today)
  const tStats = memberStats(d, T, today)

  it('has the three demo members, athletes in program week 3', () => {
    expect(snap.members.map((m) => m.id).sort()).toEqual([D, S, T].sort())
    expect(d.members[D]).toMatchObject({ role: 'coach', color: 'aqua', competes: false })
    expect(d.members[S]).toMatchObject({ role: 'athlete', color: 'blue', programId: 'bts-12', programStart: start })
    expect(d.members[T]).toMatchObject({ role: 'athlete', color: 'orange', programId: 'bts-12', programStart: start })
    expect(programWeekOn(BTS_PROGRAM, start, today)).toBe(3)
    expect(d.members[S].settings.weightVisibility).toBe('exact')
    expect(d.members[T].settings.weightVisibility).toBe('change')
    expect(snap.logs.some((l) => l.memberId === D)).toBe(false)
  })

  it('has nothing dated after today', () => {
    const end = endOf(today)
    const late = timestamps(snap).filter(([, t]) => !(t <= end))
    expect(late).toEqual([])
    for (const w of snap.weights) expect(w.date <= today).toBe(true)
    for (const c of snap.checkins) expect(c.date <= today).toBe(true)
    for (const p of snap.mealPlans) expect(p.startDate <= today).toBe(true)
  })

  it('uses the id helpers and unique ids', () => {
    for (const l of snap.logs) expect(l.id).toBe(logId(l.memberId, l.programId, l.week, l.day))
    for (const w of snap.weights) expect(w.id).toBe(dailyId(w.memberId, w.date))
    for (const c of snap.checkins) expect(c.id).toBe(dailyId(c.memberId, c.date))
    for (const c of snap.cheers) expect(c.id).toMatch(UUID)
    for (const p of snap.mealPlans) {
      expect(p.id).toMatch(UUID)
      for (const m of p.meals) expect(m.id).toMatch(UUID)
    }
    const ids = [...snap.cheers, ...snap.mealPlans, ...snap.mealPlans.flatMap((p) => p.meals)].map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of [snap.logs, snap.weights, snap.checkins]) expect(new Set(t.map((x) => x.id)).size).toBe(t.length)
  })

  it('logs real sets against existing program weeks and days', () => {
    for (const l of snap.logs) {
      const day = BTS_PROGRAM.weeks[l.week - 1]?.days[l.day]
      expect(day, l.id).toBeDefined()
      expect(l.programId).toBe(BTS_PROGRAM.id)
      expect(l.unit).toBe('kg')
      for (const [k, e] of Object.entries(l.ex)) {
        expect(Number(k)).toBeLessThan(day.ex.length)
        for (const s of e.sets) {
          expect(s.w === '' || /^\d+(\.5)?$/.test(s.w), `${l.id} ${k} w=${s.w}`).toBe(true)
          if (s.ok) expect(s.r).toMatch(/^\d+$/)
          if (s.w !== '' && s.ok) expect((Number(s.w) * 10) % 25).toBe(0)
        }
      }
      if (l.done) {
        expect(l.doneAt).toBeGreaterThan(l.startedAt ?? Infinity)
        expect(l.feel).toBeGreaterThanOrEqual(3)
        expect(l.feel).toBeLessThanOrEqual(5)
        expect(l.updatedAt).toBe(l.doneAt)
        // it was on or before its scheduled day (never trained ahead of the program)
        expect(isoFromMs(l.doneAt!) <= today).toBe(true)
      }
    }
  })

  it('follows the story: Stelios on schedule, Thanos two behind, today handled', () => {
    const due = diffDays(start, today)
    expect(due).toBeGreaterThanOrEqual(14)
    expect(sStats.schedule?.behindBy).toBe(0)
    expect(tStats.schedule?.behindBy).toBe(2)
    const ref = workoutOn(BTS_PROGRAM, start, today)
    const todays = (id: string) => ref && d.logs[logId(id, BTS_PROGRAM.id, ref.week, ref.day)]
    if (ref) {
      expect(todays(S)?.done).toBe(true)
      expect(new Date(todays(S)!.doneAt!).getHours()).toBeLessThan(10)
      const live = todays(T)!
      expect(live.done).toBe(false)
      const sets = Object.values(live.ex).flatMap((e) => e.sets)
      expect(sets.some((s) => s.ok)).toBe(true)
      expect(sets.some((s) => !s.ok)).toBe(true)
    } else {
      expect(snap.logs.filter((l) => isoFromMs(l.startedAt!) === today)).toEqual([])
    }
  })

  it('computes stats for both athletes, with PRs, badges and a feed', () => {
    expect(sStats.prs.length).toBeGreaterThan(0)
    expect(tStats.prs.length).toBeGreaterThan(0)
    expect(sStats.schedule!.consistency!).toBeGreaterThan(tStats.schedule!.consistency!)
    const sb = earnedBadges(d, S).map((b) => b.id)
    const tb = earnedBadges(d, T).map((b) => b.id)
    expect(sb).toEqual(expect.arrayContaining(['first-workout', 'first-pr', 'perfect-week', 'early-bird', 'weigh-in-7']))
    expect(tb).toEqual(expect.arrayContaining(['first-workout', 'first-pr', 'perfect-week', 'night-owl', 'ten-tonnes']))
    expect(buildFeed(d).length).toBeGreaterThan(20)
    expect(sStats.weight?.startKg).toBe(84.2)
    expect(tStats.weight?.startKg).toBe(71.5)
    expect(sStats.goalProgress).toBeGreaterThan(0)
    expect(tStats.goalProgress).toBeGreaterThan(0)
  })

  it('has nutrition adherence in the intended ranges', () => {
    const adh = (id: string) => recentAdherence(Object.values(d.checkins), currentPlan(Object.values(d.mealPlans), id), today, 14, d.mealPlans)!.ratio
    expect(adh(S)).toBeGreaterThanOrEqual(0.78)
    expect(adh(S)).toBeLessThanOrEqual(0.92)
    expect(adh(T)).toBeGreaterThanOrEqual(0.55)
    expect(adh(T)).toBeLessThanOrEqual(0.72)
    expect(sStats.adherence14).toBeCloseTo(adh(S))
  })

  it('logs food from the first plan on, so the 4-week number tells the same story', () => {
    const adh28 = (id: string) => recentAdherence(Object.values(d.checkins), currentPlan(Object.values(d.mealPlans), id), today, 28, d.mealPlans)!
    const s = adh28(S)
    const t = adh28(T)
    expect(s.days).toBe(28)
    expect(s.ratio).toBeGreaterThanOrEqual(0.78)
    expect(s.ratio).toBeLessThanOrEqual(0.92)
    // Thanos's plan is only 3-4 weeks old, so his window holds a partial fortnight: a little above his 14-day number.
    expect(t.ratio).toBeGreaterThanOrEqual(0.55)
    expect(t.ratio).toBeLessThanOrEqual(0.76)
    expect(t.ratio).toBeLessThan(s.ratio - 0.1)
    // days before v2 are logged against v1, with v1's meals
    const plans = Object.values(d.mealPlans).filter((p) => p.memberId === S)
    const v1 = plans.find((p) => !p.active)!
    const v2 = plans.find((p) => p.active)!
    const first = snap.checkins.filter((c) => c.memberId === S).sort((x, y) => (x.date < y.date ? -1 : 1))[0]
    expect(first.date).toBe(v1.startDate)
    expect(first.planId).toBe(v1.id)
    for (const c of snap.checkins.filter((c) => c.memberId === S && c.date < v2.startDate)) {
      expect(c.planId).toBe(v1.id)
      for (const m of c.meals) expect(v1.meals.some((x) => x.id === m)).toBe(true)
    }
  })

  it('keeps the head-to-head close', () => {
    const h = headToHead(sStats, tStats)
    // each side leads on at least 3 of the 9 metrics, whatever the weekday
    expect(h.a).toBeGreaterThanOrEqual(3)
    expect(h.b).toBeGreaterThanOrEqual(3)
  })

  it('has kudos on finished workouts and a fresh unseen nudge for Thanos', () => {
    const kudos = snap.cheers.filter((c) => c.kind === 'kudos')
    expect(kudos.length).toBeGreaterThan(10)
    for (const c of kudos) {
      const log = d.logs[c.ref!.replace(/^workout:/, '')]
      expect(log?.done, c.ref!).toBe(true)
      expect(c.fromId).not.toBe(c.toId)
      expect(c.toId).toBe(log.memberId)
      expect(c.createdAt).toBeGreaterThan(log.doneAt!)
      expect(['🔥', '💪', '👏', '🏆']).toContain(c.emoji)
    }
    for (const c of snap.cheers) if (c.seenAt != null) expect(c.seenAt).toBeGreaterThanOrEqual(c.createdAt)
    expect(snap.cheers.filter((c) => c.kind === 'nudge').length).toBeGreaterThanOrEqual(2)
    expect(snap.cheers.filter((c) => c.kind === 'message' && c.fromId === D)).toHaveLength(1)
    const toThanos = snap.cheers.filter((c) => c.kind === 'nudge' && c.toId === T).sort((a, b) => b.createdAt - a.createdAt)
    expect(toThanos[0].seenAt).toBeNull()
    expect(unseenCheers(d.cheers, T).some((c) => c.id === toThanos[0].id)).toBe(true)
    expect(snap.cheers.some((c) => c.seenAt != null)).toBe(true)
  })

  it('is deterministic', () => {
    expect(JSON.stringify(createDemoSnapshot(today))).toBe(JSON.stringify(snap))
  })
})

describe('createDemoSnapshot with a clock', () => {
  it('keeps everything before `now`, moving Thanos\'s live session earlier', () => {
    const today = '2026-09-24' // Thursday: Pull day
    const now = new Date(2026, 8, 24, 10, 30).getTime()
    const snap = createDemoSnapshot(today, now)
    const late = timestamps(snap).filter(([, t]) => t > now)
    expect(late).toEqual([])
    const live = snap.logs.find((l) => l.memberId === T && !l.done)
    expect(live).toBeDefined()
    expect(isoFromMs(live!.startedAt!)).toBe(today)
    expect(snap.logs.find((l) => l.memberId === S && l.week === 3 && l.day === 2)?.done).toBe(true)
  })

  it('drops today\'s events that have not happened yet early in the morning', () => {
    const today = '2026-09-24'
    const now = new Date(2026, 8, 24, 5, 0).getTime()
    const snap = createDemoSnapshot(today, now)
    expect(timestamps(snap).filter(([, t]) => t > now)).toEqual([])
    expect(snap.logs.filter((l) => l.week === 3 && l.day === 2)).toEqual([])
  })
})

describe('demo story summary', () => {
  it('reads well (set DEMO_SUMMARY=1 to print it)', () => {
    const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
    const lines: string[] = []
    for (const today of WEEK) {
      const snap = createDemoSnapshot(today)
      const d = squad(snap)
      const s = memberStats(d, S, today)
      const t = memberStats(d, T, today)
      const h = headToHead(s, t)
      const fmt = (x: number | null) => (x == null ? '-' : Math.abs(x) < 10 ? x.toFixed(2) : Math.round(x).toString())
      lines.push(
        `${today} h2h ${h.a}-${h.b} | ` +
          h.rows.map((r) => `${r.key} ${fmt(r.a)}/${fmt(r.b)}${r.winner === 'a' ? '<' : r.winner === 'b' ? '>' : '='}`).join(' ') +
          ` | badges ${earnedBadges(d, S).length}/${earnedBadges(d, T).length}` +
          ` | vol ${Math.round(s.volumeTotalKg)}/${Math.round(t.volumeTotalKg)}` +
          ` | kg ${s.weight?.latestKg}/${t.weight?.latestKg}` +
          ` | cheers ${snap.cheers.length} unseen ${unseenCheers(d.cheers, S).length}/${unseenCheers(d.cheers, T).length}`,
      )
      if (today === WEEK[6] && env.DEMO_SUMMARY) {
        lines.push('S badges: ' + earnedBadges(d, S).map((b) => b.id).join(', '))
        lines.push('T badges: ' + earnedBadges(d, T).map((b) => b.id).join(', '))
        for (const id of [S, T]) {
          const prs = personalRecords(Object.values(d.logs).filter((l) => l.memberId === id), d.programs)
          lines.push(`${id} PRs: ` + prs.map((p) => `${p.date.slice(5)} ${p.exercise} ${p.kg}x${p.reps}`).join(', '))
        }
      }
    }
    if (env.DEMO_SUMMARY) console.log(lines.join('\n'))
    expect(lines.length).toBeGreaterThanOrEqual(WEEK.length)
  })
})
