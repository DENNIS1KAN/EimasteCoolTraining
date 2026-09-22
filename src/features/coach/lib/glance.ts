/**
 * "Squad at a glance" for the coach: who is on track this week, who is behind schedule, who hasn't
 * stepped on the scale, and how well everyone sticks to their meal plan.
 */
import type { Member } from '../../../data/types'
import type { ISODate } from '../../../lib/dates'
import { addDays, dateRange, diffDays, isoFromMs, startOfWeek } from '../../../lib/dates'
import { memberStats, programOf, sortedMembers, weightsOf, workoutOn, type MemberStats, type SquadData } from '../../../lib/stats'

/** Days without a weigh-in after which the coach is warned. */
export const WEIGH_IN_STALE_DAYS = 7
/** Nutrition adherence (last 14 days) below which the coach is warned. */
export const LOW_ADHERENCE = 0.6

export type GlanceFlag = 'behind' | 'noWeighIn' | 'lowFood' | 'notStarted' | 'noProgram'

export interface AthleteGlance {
  member: Member
  stats: MemberStats
  /** Workouts finished this calendar week (Mon-Sun). */
  weekDone: number
  /** Workouts the program schedules this calendar week (the weekly pattern before the start date). */
  weekTarget: number
  /** Scheduled workouts that fell on days before today this week. */
  weekDueSoFar: number
  /** Program workouts missed so far (not counting today's). */
  behindBy: number
  lastWeighIn: ISODate | null
  daysSinceWeighIn: number | null
  /** Nutrition adherence over the last 14 days, 0..1 (null without a meal plan). */
  adherence: number | null
  lastActiveAt: number | null
  flags: GlanceFlag[]
}

/** Latest time the member wrote anything: a workout, weigh-in, food check-in or cheer. */
export function lastActiveAt(d: SquadData, memberId: string): number | null {
  let t = 0
  for (const l of Object.values(d.logs)) if (l.memberId === memberId) t = Math.max(t, l.doneAt ?? 0, l.updatedAt)
  for (const w of Object.values(d.weights)) if (w.memberId === memberId) t = Math.max(t, w.updatedAt)
  for (const c of Object.values(d.checkins)) if (c.memberId === memberId) t = Math.max(t, c.updatedAt)
  for (const c of Object.values(d.cheers)) if (c.fromId === memberId) t = Math.max(t, c.createdAt)
  return t > 0 ? t : null
}

/** Members the coach keeps accountable: athletes, plus anyone (e.g. a training coach) with a started program. */
export const trainees = (d: SquadData): Member[] => sortedMembers(d).filter((m) => m.role === 'athlete' || (!!m.programId && !!m.programStart))

export function athleteGlance(d: SquadData, m: Member, today: ISODate): AthleteGlance {
  const stats = memberStats(d, m.id, today)
  const program = programOf(d, m)
  const start = m.programStart
  const weekStart = startOfWeek(today)
  let weekTarget = stats.thisWeek.target
  let weekDueSoFar = 0
  if (program && start) {
    const days = dateRange(weekStart, addDays(weekStart, 6))
    weekTarget = days.filter((day) => workoutOn(program, start, day)).length
    weekDueSoFar = days.filter((day) => day < today && workoutOn(program, start, day)).length
  }
  const weighDates = weightsOf(d, m.id).map((w) => w.date).filter((x) => x <= today)
  const lastWeighIn = weighDates.length ? weighDates.reduce((a, b) => (a > b ? a : b)) : null
  const daysSinceWeighIn = lastWeighIn ? diffDays(lastWeighIn, today) : null
  const behindBy = stats.schedule?.started ? stats.schedule.behindBy : 0

  const flags: GlanceFlag[] = []
  if (!program) flags.push('noProgram')
  else if (!start) flags.push('notStarted')
  if (behindBy > 0) flags.push('behind')
  if (daysSinceWeighIn == null || daysSinceWeighIn >= WEIGH_IN_STALE_DAYS) flags.push('noWeighIn')
  if (stats.adherence14 != null && stats.adherence14 < LOW_ADHERENCE) flags.push('lowFood')

  return {
    member: m,
    stats,
    weekDone: stats.thisWeek.done,
    weekTarget,
    weekDueSoFar,
    behindBy,
    lastWeighIn,
    daysSinceWeighIn,
    adherence: stats.adherence14,
    lastActiveAt: lastActiveAt(d, m.id),
    flags,
  }
}

const SEVERITY: Record<GlanceFlag, number> = { behind: 10, notStarted: 6, noProgram: 5, noWeighIn: 3, lowFood: 2 }
export const glanceSeverity = (g: AthleteGlance): number => g.flags.reduce((a, f) => a + SEVERITY[f], 0) + g.behindBy

/** Everyone the coach keeps accountable, the ones needing attention first (then by name). */
export function squadGlance(d: SquadData, today: ISODate): AthleteGlance[] {
  return trainees(d)
    .map((m) => athleteGlance(d, m, today))
    .sort((a, b) => glanceSeverity(b) - glanceSeverity(a) || a.member.name.localeCompare(b.member.name))
}

export interface GlanceTotals {
  athletes: number
  onTrack: number
  weekDone: number
  weekTarget: number
  /** Mean adherence of athletes with a plan (null when nobody has one). */
  adherence: number | null
}

export function glanceTotals(rows: AthleteGlance[]): GlanceTotals {
  const withPlan = rows.filter((r) => r.adherence != null)
  return {
    athletes: rows.length,
    onTrack: rows.filter((r) => r.member.programStart && !r.flags.includes('behind')).length,
    weekDone: rows.reduce((a, r) => a + r.weekDone, 0),
    weekTarget: rows.reduce((a, r) => a + r.weekTarget, 0),
    adherence: withPlan.length ? withPlan.reduce((a, r) => a + (r.adherence as number), 0) / withPlan.length : null,
  }
}

/** Day of the latest activity, for "last active" labels that don't need minutes. */
export const lastActiveDate = (g: Pick<AthleteGlance, 'lastActiveAt'>): ISODate | null => (g.lastActiveAt ? isoFromMs(g.lastActiveAt) : null)
