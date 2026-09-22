import type { ISODate } from '../../../lib/dates'
import { addDays, startOfWeek } from '../../../lib/dates'
import { metricValue, points, type MemberStats, type MetricKey, type Points, type SquadData } from '../../../lib/stats'

export type LeaguePeriod = 'week' | 'all'

export interface Standing {
  memberId: string
  points: Points
  /** 1-based; equal totals share a rank. */
  rank: number
}

/** Monday..Sunday of the week containing `today`. */
export function weekRange(today: ISODate): { from: ISODate; to: ISODate } {
  const from = startOfWeek(today)
  return { from, to: addDays(from, 6) }
}

/** Rank members by points in a period. Ties share a rank; within a tie, more workouts first, then name order of `memberIds`. */
export function standings(d: SquadData, memberIds: string[], period: LeaguePeriod, today: ISODate): Standing[] {
  const range = period === 'week' ? weekRange(today) : { from: undefined, to: undefined }
  const rows = memberIds.map((id, i) => ({ memberId: id, points: points(d, id, range.from, range.to), i }))
  rows.sort((a, b) => b.points.total - a.points.total || b.points.workouts - a.points.workouts || a.i - b.i)
  return withRanks(rows.map(({ memberId, points: p }) => ({ memberId, points: p })), (r) => r.points.total)
}

/** Assigns competition ranks ("1, 1, 3") to rows already sorted best-first. */
export function withRanks<T>(rows: T[], value: (r: T) => number | null): (T & { rank: number })[] {
  let rank = 0
  let prev: number | null | undefined
  return rows.map((r, i) => {
    const v = value(r)
    if (i === 0 || v !== prev) rank = i + 1
    prev = v
    return { ...r, rank }
  })
}

/** This week's MVP(s): everyone sharing the top score, as long as it's above zero. */
export function mvps(rows: Standing[]): string[] {
  if (!rows.length || rows[0].points.total <= 0) return []
  return rows.filter((r) => r.points.total === rows[0].points.total).map((r) => r.memberId)
}

/** Category leaderboards: ids of the members at the top (ties included); empty when nobody has a value above zero. */
export type CategoryKey = 'consistency' | 'volumeWeek' | 'prs30' | 'strength' | 'nutrition' | 'goal'
export const CATEGORIES: CategoryKey[] = ['consistency', 'volumeWeek', 'prs30', 'strength', 'nutrition', 'goal']

export function categoryValue(s: MemberStats, key: CategoryKey): number | null {
  if (key === 'prs30') return s.prs30d
  return metricValue(s, key as MetricKey)
}

export interface CategoryLeader {
  key: CategoryKey
  leaders: string[]
  value: number | null
  /** Everyone with a value, best first (for the runner-up line). */
  ranking: { memberId: string; value: number; rank: number }[]
}

export function categoryLeaders(stats: MemberStats[], keys: CategoryKey[] = CATEGORIES): CategoryLeader[] {
  return keys.map((key) => {
    const withValue = stats
      .map((s) => ({ memberId: s.memberId, value: categoryValue(s, key) }))
      .filter((r): r is { memberId: string; value: number } => r.value != null && Number.isFinite(r.value))
      .sort((a, b) => b.value - a.value)
    const ranking = withRanks(withValue, (r) => r.value)
    const top = ranking[0]
    const leaders = top && top.value > 0 ? ranking.filter((r) => r.rank === 1).map((r) => r.memberId) : []
    return { key, leaders, value: top && leaders.length ? top.value : null, ranking }
  })
}
