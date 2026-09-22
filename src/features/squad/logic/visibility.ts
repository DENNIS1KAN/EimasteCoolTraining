import type { Member } from '../../../data/types'
import type { MemberStats } from '../../../lib/stats'

/** What a viewer may see of a member's body weight. */
export type WeightAccess = 'exact' | 'change' | 'hidden'

/**
 * Mirrors the database policy: you always see your own weight, the coach sees everyone's, and squad mates
 * see it as the member chose in Settings ('exact' kg, 'change' as ± only, 'private' not at all).
 */
export function weightAccess(member: Pick<Member, 'id' | 'settings'>, viewer: Pick<Member, 'id' | 'role'> | null | undefined): WeightAccess {
  if (viewer && (viewer.id === member.id || viewer.role === 'coach')) return 'exact'
  const v = member.settings?.weightVisibility
  if (v === 'exact') return 'exact'
  if (v === 'private') return 'hidden'
  return 'change'
}

/**
 * Stats as the viewer is allowed to see them: a hidden weight also hides goal progress (it would reveal the
 * trend). Returns the same object when nothing needs hiding, so memoized consumers stay stable.
 */
export function visibleStats(s: MemberStats, access: WeightAccess): MemberStats {
  if (access !== 'hidden' || (s.weight == null && s.goalProgress == null)) return s
  return { ...s, weight: null, goalProgress: null }
}
