import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../data/store'
import type { Cheer } from '../../data/types'
import { todayISO, type ISODate } from '../../lib/dates'
import type { SquadData } from '../../lib/stats'

const NO_CHEERS: Record<string, Cheer> = {}

/** A clock that ticks every `ms` and when the tab becomes visible again (so "today" rolls over after midnight). */
export function useNow(ms = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const onVis = () => document.visibilityState === 'visible' && tick()
    const id = window.setInterval(tick, ms)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [ms])
  return now
}

/** Today's ISO date, stable between ticks of the clock. */
export function useToday(now: number): ISODate {
  return todayISO(new Date(now))
}

/**
 * The tables the stats need, as one memoized SquadData. Cheers are left out (reactions don't change stats);
 * pass `withCheers` when they matter (the feed).
 */
export function useSquadData(withCheers = false): SquadData {
  const members = useStore((s) => s.members)
  const programs = useStore((s) => s.programs)
  const logs = useStore((s) => s.logs)
  const weights = useStore((s) => s.weights)
  const mealPlans = useStore((s) => s.mealPlans)
  const checkins = useStore((s) => s.checkins)
  const cheers = useStore((s) => (withCheers ? s.cheers : NO_CHEERS))
  return useMemo(
    () => ({ members, programs, logs, weights, mealPlans, checkins, cheers }),
    [members, programs, logs, weights, mealPlans, checkins, cheers],
  )
}

/** Unseen nudges and messages for a member (the bell badge). */
export function useUnseenCount(memberId: string): number {
  return useStore((s) => {
    let n = 0
    for (const c of Object.values(s.cheers)) if (c.toId === memberId && !c.seenAt && c.kind !== 'kudos') n++
    return n
  })
}

/** The squad's coach (first coach by name), for the coach note and "waiting on the coach" hints. */
export function useCoach(excludeId?: string) {
  return useStore((s) => {
    const coaches = Object.values(s.members).filter((m) => m.role === 'coach' && m.id !== excludeId)
    return coaches.sort((a, b) => a.name.localeCompare(b.name))[0] ?? null
  })
}
