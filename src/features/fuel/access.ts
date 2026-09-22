import type { Member } from '../../data/types'

/**
 * The database lets athletes write their own meal plans, but the editor route (/coach/plan/...) is wrapped in
 * RequireCoach in App.tsx. Flip this once that route admits athletes for their own slug, and the Fuel screen
 * will offer them "Create my plan" / "Edit plan" too.
 */
export const ATHLETES_EDIT_OWN_PLANS = false

/** May the viewer edit this member's meal plans (in the UI)? */
export function canEditPlans(viewer: Member | null | undefined, memberId: string): boolean {
  if (!viewer) return false
  if (viewer.role === 'coach') return true
  return ATHLETES_EDIT_OWN_PLANS && viewer.id === memberId
}

/** Whether the editor page itself admits the viewer (the page checks this too, independent of the route guard). */
export function mayOpenEditor(viewer: Member | null | undefined, memberId: string): boolean {
  if (!viewer) return false
  return viewer.role === 'coach' || viewer.id === memberId
}

export const editorPath = (slug: string, planId: string): string => `/coach/plan/${encodeURIComponent(slug)}/${encodeURIComponent(planId)}`
