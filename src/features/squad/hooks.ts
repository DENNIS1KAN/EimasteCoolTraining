import { useEffect, useMemo, useState } from 'react'
import { useMe, useStore } from '../../data/store'
import type { Cheer, Member } from '../../data/types'
import { todayISO, type ISODate } from '../../lib/dates'
import { competitors, memberStats, points, type MemberStats, type SquadData } from '../../lib/stats'
import { visibleStats, weightAccess } from './logic/visibility'

const NO_CHEERS: Record<string, Cheer> = {}

/** Today's date, refreshed when the tab comes back after midnight. */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const check = () => setToday((cur) => (cur === todayISO() ? cur : todayISO()))
    document.addEventListener('visibilitychange', check)
    const id = window.setInterval(check, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.clearInterval(id)
    }
  }, [])
  return today
}

/** A clock for relative times ("2 h ago") and cooldowns, ticking every minute. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/**
 * The squad tables the stats need. Cheers are left out on purpose (`cheers: {}`), so reacting with kudos
 * doesn't recompute everyone's stats; use useSquadDataWithCheers when cheers matter (feed, badges).
 */
export function useStatsData(): SquadData {
  const members = useStore((s) => s.members)
  const programs = useStore((s) => s.programs)
  const logs = useStore((s) => s.logs)
  const weights = useStore((s) => s.weights)
  const mealPlans = useStore((s) => s.mealPlans)
  const checkins = useStore((s) => s.checkins)
  return useMemo(
    () => ({ members, programs, logs, weights, mealPlans, checkins, cheers: NO_CHEERS }),
    [members, programs, logs, weights, mealPlans, checkins],
  )
}

export function useSquadDataWithCheers(): SquadData {
  const base = useStatsData()
  const cheers = useStore((s) => s.cheers)
  return useMemo(() => ({ ...base, cheers }), [base, cheers])
}

/** Everyone's stats as the viewer may see them (private weights hidden), keyed by member id. */
export function useAllStats(data: SquadData, today: ISODate, viewer: Member | null): Record<string, MemberStats> {
  return useMemo(() => {
    const out: Record<string, MemberStats> = {}
    for (const m of Object.values(data.members)) out[m.id] = visibleStats(memberStats(data, m.id, today), weightAccess(m, viewer))
    return out
  }, [data, today, viewer])
}

export function useCompetitors(data: SquadData): Member[] {
  return useMemo(() => competitors(data), [data])
}

/** All-time league points per member (used to pick a fair rival). */
export function useAllTimePoints(data: SquadData, members: Member[]): Record<string, number> {
  return useMemo(() => Object.fromEntries(members.map((m) => [m.id, points(data, m.id).total])), [data, members])
}

/** The common bundle most squad screens need. */
export function useSquad() {
  const me = useMe()
  const today = useToday()
  const data = useStatsData()
  const stats = useAllStats(data, today, me)
  const comps = useCompetitors(data)
  return { me, today, data, stats, competitors: comps }
}

export const memberBySlug = (members: Record<string, Member>, slug: string | undefined): Member | null =>
  (slug && Object.values(members).find((m) => m.slug === slug)) || null
