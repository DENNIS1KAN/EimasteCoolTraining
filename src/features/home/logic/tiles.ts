import type { ISODate } from '../../../lib/dates'
import type { MemberStats } from '../../../lib/stats'

/** PRs set in the calendar month of `today`. */
export const prsInMonth = (prs: { date: ISODate }[], today: ISODate): number => prs.filter((p) => p.date.slice(0, 7) === today.slice(0, 7)).length

/** On-schedule percentage (0..100, rounded), or null until the first workout is due. */
export function onSchedulePct(s: Pick<MemberStats, 'schedule'>): number | null {
  const c = s.schedule?.consistency
  return c == null ? null : Math.round(c * 100)
}

/**
 * The stat tiles only make sense once there is something to count: a started program or any finished workout.
 * A brand-new account sees the onboarding checklist instead of three zeros.
 */
export const hasTrainingStats = (s: Pick<MemberStats, 'programWeek' | 'workoutsDone' | 'lastWorkoutAt' | 'prs'>): boolean =>
  s.programWeek > 0 || s.workoutsDone > 0 || s.lastWorkoutAt != null || s.prs.length > 0
