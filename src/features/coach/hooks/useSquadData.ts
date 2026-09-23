import { useMemo } from 'react'
import { useStore } from '../../../data/store'
import type { SquadData } from '../../../lib/stats'

/** The squad's tables as SquadData; a new object only when one of the tables changes. */
export function useSquadData(): SquadData {
  const members = useStore((s) => s.members)
  const programs = useStore((s) => s.programs)
  const logs = useStore((s) => s.logs)
  const weights = useStore((s) => s.weights)
  const mealPlans = useStore((s) => s.mealPlans)
  const checkins = useStore((s) => s.checkins)
  const cheers = useStore((s) => s.cheers)
  const posts = useStore((s) => s.posts)
  return useMemo(
    () => ({ members, programs, logs, weights, mealPlans, checkins, cheers, posts }),
    [members, programs, logs, weights, mealPlans, checkins, cheers, posts],
  )
}
