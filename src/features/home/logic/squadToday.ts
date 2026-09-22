/**
 * The coach's "Squad today": for every athlete, what today looks like (trained, training now, due, rest),
 * whether they are behind schedule, how long since they stepped on the scale, and their latest food check-in.
 * Behind / stale weigh-in rules come from the coach console's glance, so both screens agree.
 */
import { dayShortName } from '../../../data/programs'
import type { CheckinRating, Member, Program, WorkoutLog } from '../../../data/types'
import type { ISODate } from '../../../lib/dates'
import { isoFromMs } from '../../../lib/dates'
import { checkinPlan, checkinScore, currentPlan, isLogStarted, logTime, plansOf, programOf, type SquadData } from '../../../lib/stats'
import { athleteGlance, trainees, type AthleteGlance } from '../../coach/lib/glance'

export type TodayStatus =
  | { kind: 'done'; dayName: string; at: number }
  | { kind: 'training'; dayName: string; since: number | null }
  | { kind: 'due'; dayName: string }
  | { kind: 'rest' }
  | { kind: 'startsOn'; date: ISODate }
  | { kind: 'noStart' }
  | { kind: 'noProgram' }
  | { kind: 'finished' }

export interface LastCheckin {
  date: ISODate
  rating: CheckinRating | null
  /** 0..1, as scored for adherence. */
  score: number
  meals: number
  mealsTotal: number
}

export interface SquadTodayRow {
  member: Member
  glance: AthleteGlance
  status: TodayStatus
  behindBy: number
  daysSinceWeighIn: number | null
  staleWeighIn: boolean
  hasPlan: boolean
  lastCheckin: LastCheckin | null
  /** Behind schedule or a stale weigh-in: worth a nudge. */
  push: boolean
}

export interface SquadTodaySummary {
  athletes: number
  trainedToday: number
  /** Athletes with a workout today (done, in progress or still due). */
  scheduledToday: number
  behind: number
  staleWeighIns: number
}

const nameOf = (p: Program, week: number, day: number): string => {
  const d = p.weeks[week - 1]?.days[day]
  return d ? dayShortName(d) : ''
}
const newest = (a: WorkoutLog, b: WorkoutLog) => logTime(b) - logTime(a)

export function todayStatus(d: SquadData, m: Member, g: AthleteGlance, today: ISODate): TodayStatus {
  const program = programOf(d, m)
  if (!program) return { kind: 'noProgram' }
  const logs = Object.values(d.logs).filter((l) => l.memberId === m.id && l.programId === program.id)
  const doneToday = logs.filter((l) => l.done && isoFromMs(logTime(l)) === today).sort(newest)[0]
  if (doneToday) return { kind: 'done', dayName: nameOf(program, doneToday.week, doneToday.day), at: logTime(doneToday) }
  const live = logs.filter((l) => !l.done && isLogStarted(l) && isoFromMs(l.updatedAt) === today).sort((a, b) => b.updatedAt - a.updatedAt)[0]
  if (live) return { kind: 'training', dayName: nameOf(program, live.week, live.day), since: live.startedAt }
  if (!m.programStart) return { kind: 'noStart' }
  if (m.programStart > today) return { kind: 'startsOn', date: m.programStart }
  if (g.stats.schedule?.finished) return { kind: 'finished' }
  const ref = g.stats.schedule?.today
  if (ref && !logs.some((l) => l.done && l.week === ref.week && l.day === ref.day))
    return { kind: 'due', dayName: nameOf(program, ref.week, ref.day) }
  return { kind: 'rest' }
}

export function lastCheckin(d: SquadData, m: Member, today: ISODate): LastCheckin | null {
  let c = null
  for (const x of Object.values(d.checkins)) if (x.memberId === m.id && x.date <= today && (!c || x.date > c.date)) c = x
  if (!c) return null
  const plan = checkinPlan(c, d.mealPlans, currentPlan(plansOf(d, m.id), m.id))
  const ids = new Set(plan?.meals.map((x) => x.id) ?? [])
  return {
    date: c.date,
    rating: c.rating,
    score: checkinScore(c, plan),
    meals: c.meals.filter((id) => ids.has(id)).length,
    mealsTotal: ids.size,
  }
}

export function squadTodayRow(d: SquadData, m: Member, today: ISODate): SquadTodayRow {
  const g = athleteGlance(d, m, today)
  const staleWeighIn = g.flags.includes('noWeighIn')
  return {
    member: m,
    glance: g,
    status: todayStatus(d, m, g, today),
    behindBy: g.behindBy,
    daysSinceWeighIn: g.daysSinceWeighIn,
    staleWeighIn,
    hasPlan: plansOf(d, m.id).some((p) => p.active),
    lastCheckin: lastCheckin(d, m, today),
    push: g.behindBy > 0 || staleWeighIn,
  }
}

/** Everyone the coach keeps accountable; the ones worth a nudge first (most behind first), then by name. */
export function squadToday(d: SquadData, today: ISODate): SquadTodayRow[] {
  return trainees(d)
    .map((m) => squadTodayRow(d, m, today))
    .sort((a, b) => Number(b.push) - Number(a.push) || b.behindBy - a.behindBy || a.member.name.localeCompare(b.member.name))
}

export function summarize(rows: SquadTodayRow[]): SquadTodaySummary {
  const k = (r: SquadTodayRow) => r.status.kind
  return {
    athletes: rows.length,
    trainedToday: rows.filter((r) => k(r) === 'done').length,
    scheduledToday: rows.filter((r) => k(r) === 'done' || k(r) === 'training' || k(r) === 'due').length,
    behind: rows.filter((r) => r.behindBy > 0).length,
    staleWeighIns: rows.filter((r) => r.staleWeighIn).length,
  }
}
