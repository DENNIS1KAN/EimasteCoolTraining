export type CoachTab = 'squad' | 'nutrition' | 'programs'
export const COACH_TABS: CoachTab[] = ['squad', 'nutrition', 'programs']

/** ?tab=… (also accepts the older "members" name for the squad tab). */
export function parseCoachTab(v: string | null): CoachTab {
  if (v === 'members') return 'squad'
  return COACH_TABS.includes(v as CoachTab) ? (v as CoachTab) : 'squad'
}
