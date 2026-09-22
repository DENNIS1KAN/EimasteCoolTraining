import { totalWorkouts } from '../../data/programs'
import type { ISODate } from '../dates'
import { addDays, fromISODate, isoFromMs, startOfWeek } from '../dates'
import { weightSeries } from './body'
import { logTime, personalRecords, sessionSummary } from './lifts'
import { checkinsOf, logsOf, plansOf, sharesWeight, weightsOf, type SquadData } from './member'
import { checkinPlan, checkinScore, currentPlan } from './nutrition'

export type BadgeId =
  | 'first-workout'
  | 'workouts-10'
  | 'workouts-25'
  | 'halfway'
  | 'program-complete'
  | 'perfect-week'
  | 'streak-4'
  | 'first-pr'
  | 'prs-10'
  | 'prs-25'
  | 'ten-tonnes'
  | 'early-bird'
  | 'night-owl'
  | 'weigh-in-7'
  | 'on-plan-7'
  | 'goal-reached'
  | 'hype-squad'

export type BadgeTier = 'bronze' | 'silver' | 'gold'

/** Display order and tier. Texts live in the UI (features/shared/badges). */
export const BADGES: { id: BadgeId; tier: BadgeTier }[] = [
  { id: 'first-workout', tier: 'bronze' },
  { id: 'workouts-10', tier: 'bronze' },
  { id: 'workouts-25', tier: 'silver' },
  { id: 'halfway', tier: 'silver' },
  { id: 'program-complete', tier: 'gold' },
  { id: 'perfect-week', tier: 'silver' },
  { id: 'streak-4', tier: 'gold' },
  { id: 'first-pr', tier: 'bronze' },
  { id: 'prs-10', tier: 'silver' },
  { id: 'prs-25', tier: 'gold' },
  { id: 'ten-tonnes', tier: 'silver' },
  { id: 'early-bird', tier: 'bronze' },
  { id: 'night-owl', tier: 'bronze' },
  { id: 'weigh-in-7', tier: 'bronze' },
  { id: 'on-plan-7', tier: 'silver' },
  { id: 'goal-reached', tier: 'gold' },
  { id: 'hype-squad', tier: 'bronze' },
]

export interface EarnedBadge {
  id: BadgeId
  /** When it was earned (ms). */
  at: number
}

/** Longest run of consecutive ISO dates ending at each date; returns the date the run first reached `n`. */
function firstRunOf(dates: ISODate[], n: number): ISODate | null {
  const sorted = [...new Set(dates)].sort()
  let run = 0
  let prev: ISODate | null = null
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    if (run >= n) return d
    prev = d
  }
  return null
}

const endOfDay = (d: ISODate) => fromISODate(d).getTime() + 11 * 3600000

export function earnedBadges(d: SquadData, memberId: string): EarnedBadge[] {
  const m = d.members[memberId]
  if (!m) return []
  const out: EarnedBadge[] = []
  const add = (id: BadgeId, at: number | null | undefined) => {
    if (at != null && Number.isFinite(at)) out.push({ id, at })
  }
  const logs = logsOf(d, memberId)
  const done = logs.filter((l) => l.done).sort((a, b) => logTime(a) - logTime(b))
  const nth = (n: number) => (done.length >= n ? logTime(done[n - 1]) : null)
  add('first-workout', nth(1))
  add('workouts-10', nth(10))
  add('workouts-25', nth(25))
  const program = m.programId ? d.programs[m.programId] : undefined
  if (program) {
    const pDone = done.filter((l) => l.programId === program.id)
    const total = totalWorkouts(program)
    if (pDone.length >= Math.ceil(total / 2)) add('halfway', logTime(pDone[Math.ceil(total / 2) - 1]))
    if (pDone.length >= total) add('program-complete', logTime(pDone[total - 1]))
  }
  // perfect program week: all workouts of a program week done
  const weeks = new Map<string, number[]>()
  for (const l of done) {
    const k = `${l.programId}#${l.week}`
    weeks.set(k, [...(weeks.get(k) ?? []), logTime(l)])
  }
  let perfectAt: number | null = null
  for (const [k, times] of weeks) {
    const [pid, wk] = k.split('#')
    const n = d.programs[pid]?.weeks[Number(wk) - 1]?.days.length ?? 0
    if (n && times.length >= n) {
      const at = Math.max(...times)
      if (perfectAt == null || at < perfectAt) perfectAt = at
    }
  }
  add('perfect-week', perfectAt)
  // 4 consecutive calendar weeks with >= 3 workouts
  const perWeek = new Map<ISODate, number[]>()
  for (const l of done) {
    const w = startOfWeek(isoFromMs(logTime(l)))
    perWeek.set(w, [...(perWeek.get(w) ?? []), logTime(l)])
  }
  const qualifying = [...perWeek.entries()].filter(([, t]) => t.length >= 3).map(([w]) => w).sort()
  let run = 0
  for (let i = 0; i < qualifying.length; i++) {
    run = i > 0 && addDays(qualifying[i - 1], 7) === qualifying[i] ? run + 1 : 1
    if (run >= 4) {
      add('streak-4', [...perWeek.get(qualifying[i])!].sort((a, b) => a - b)[2])
      break
    }
  }
  const prs = personalRecords(logs, d.programs)
  add('first-pr', prs[0]?.at)
  add('prs-10', prs[9]?.at)
  add('prs-25', prs[24]?.at)
  const tenTonnes = done.find((l) => sessionSummary(l, d.programs[l.programId]).volumeKg >= 10000)
  add('ten-tonnes', tenTonnes ? logTime(tenTonnes) : null)
  add('early-bird', done.find((l) => l.doneAt != null && new Date(l.doneAt).getHours() < 8)?.doneAt ?? null)
  add('night-owl', done.find((l) => l.doneAt != null && new Date(l.doneAt).getHours() >= 22)?.doneAt ?? null)
  // Weight badges only while the squad can read the weigh-ins, so every phone awards the same badges.
  const weights = sharesWeight(m) ? weightsOf(d, memberId) : []
  const weighDay = firstRunOf(weights.map((w) => w.date), 7)
  add('weigh-in-7', weighDay ? endOfDay(weighDay) : null)
  const plan = currentPlan(plansOf(d, memberId), memberId)
  const goodDays = checkinsOf(d, memberId)
    .filter((c) => checkinScore(c, checkinPlan(c, d.mealPlans, plan)) >= 0.8)
    .map((c) => c.date)
  const planDay = firstRunOf(goodDays, 7)
  add('on-plan-7', planDay ? endOfDay(planDay) : null)
  if (m.goalWeightKg != null) {
    const series = weightSeries(weights)
    if (series.length >= 2) {
      const start = series[0].kg
      const down = m.goalWeightKg < start
      const hit = series.find((p) => (down ? p.trendKg <= m.goalWeightKg! : p.trendKg >= m.goalWeightKg!))
      if (hit && Math.abs(start - m.goalWeightKg) >= 0.5) add('goal-reached', endOfDay(hit.date))
    }
  }
  const given = Object.values(d.cheers)
    .filter((c) => c.fromId === memberId && c.kind === 'kudos')
    .sort((a, b) => a.createdAt - b.createdAt)
  add('hype-squad', given.length >= 10 ? given[9].createdAt : null)
  return out.sort((a, b) => a.at - b.at)
}
