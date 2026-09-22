import { useMemo } from 'react'
import { useStore } from '../../data/store'
import type { Member, WeightEntry } from '../../data/types'
import { todayISO, type ISODate } from '../../lib/dates'
import { weightSeries, weightStats, type TrendPoint, type WeightStats } from '../../lib/stats'
import { goalView, latestEntry, phaseOf, type GoalView, type Phase } from './logic'

/** One member's weigh-ins (unsorted), re-derived only when the weights table changes. */
export function useMemberWeights(memberId: string | null | undefined): WeightEntry[] {
  const weights = useStore((s) => s.weights)
  return useMemo(() => (memberId ? Object.values(weights).filter((w) => w.memberId === memberId) : []), [weights, memberId])
}

export interface WeightModel {
  entries: WeightEntry[]
  /** Ascending, with the smoothed trend. */
  series: TrendPoint[]
  stats: WeightStats | null
  latest: WeightEntry | null
  phase: Phase | null
  goal: GoalView | null
  today: ISODate
}

/** Everything the body screens derive from a member's weigh-ins, memoized on the member and the weights table. */
export function useWeightModel(member: Member | null | undefined): WeightModel {
  const entries = useMemberWeights(member?.id)
  const today = todayISO()
  const programStart = member?.programStart ?? null
  const goalKg = member?.goalWeightKg ?? null
  return useMemo(() => {
    const series = weightSeries(entries)
    const stats = weightStats(entries, programStart, today)
    return {
      entries,
      series,
      stats,
      latest: latestEntry(entries),
      phase: phaseOf(stats?.startKg, goalKg),
      goal: goalView({ startKg: stats?.startKg, currentKg: stats?.trendKg, goalKg, weeklyRateKg: stats?.weeklyRateKg, today }),
      today,
    }
  }, [entries, programStart, goalKg, today])
}
