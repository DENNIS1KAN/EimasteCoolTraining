import { useEffect, useMemo, useState } from 'react'
import type { FileRef, MealPlan, NutritionCheckin } from '../../data/types'
import { getBackend, put, remove, useStore } from '../../data/store'
import { currentPlan } from '../../lib/stats'
import { isBlankCheckin } from './lib/day'

export interface FuelData {
  /** The member's plans, newest start date first. */
  plans: MealPlan[]
  /** The plan in force (the active one, else the newest). */
  current: MealPlan | null
  /** Every other plan of the member, newest first. */
  older: MealPlan[]
  checkins: NutritionCheckin[]
  byDate: Map<string, NutritionCheckin>
  /** The whole meal plan table (to score past check-ins against their own plan). */
  allPlans: Record<string, MealPlan>
}

export const byNewest = (a: MealPlan, b: MealPlan): number =>
  a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : b.createdAt - a.createdAt

/** A member's meal plans and check-ins, memoized on the two tables. */
export function useFuelData(memberId: string | null | undefined): FuelData {
  const mealPlans = useStore((s) => s.mealPlans)
  const checkinTable = useStore((s) => s.checkins)
  return useMemo(() => {
    const plans = Object.values(mealPlans)
      .filter((p) => p.memberId === memberId)
      .sort(byNewest)
    const current = memberId ? currentPlan(plans, memberId) : null
    const checkins = Object.values(checkinTable).filter((c) => c.memberId === memberId)
    return {
      plans,
      current,
      older: plans.filter((p) => p !== current),
      checkins,
      byDate: new Map(checkins.map((c) => [c.date, c])),
      allPlans: mealPlans,
    }
  }, [mealPlans, checkinTable, memberId])
}

/** The current time, refreshed every `ms` (default one minute) so "next meal" and "today" stay right. */
export function useNow(ms = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ms])
  return now
}

export type FileUrlState = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error'; missing: boolean }

/** Resolves a stored file to a URL the browser can open (signed URL or object URL; both backends cache it). */
export function useFileUrl(ref: FileRef | null): FileUrlState {
  const path = ref?.path ?? null
  const [state, setState] = useState<{ path: string | null; value: FileUrlState }>({ path: null, value: { status: 'loading' } })
  useEffect(() => {
    if (!ref) return
    let alive = true
    getBackend()
      .fileUrl(ref)
      .then((url) => alive && setState({ path: ref.path, value: { status: 'ready', url } }))
      .catch((e: unknown) => {
        const missing = typeof e === 'object' && e != null && (e as { code?: string }).code === 'not_found'
        if (alive) setState({ path: ref.path, value: { status: 'error', missing } })
      })
    return () => {
      alive = false
    }
  }, [path])
  return state.path === path && path != null ? state.value : { status: 'loading' }
}

/** Store a check-in, or delete the row when nothing is left in it. */
export function saveCheckin(c: NutritionCheckin, existed: boolean, opts?: { debounceMs?: number }): void {
  if (isBlankCheckin(c)) {
    if (existed) remove('checkins', c.id)
    return
  }
  put('checkins', c, opts)
}
