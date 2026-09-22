/** Program-level helpers for the Train screens: blocks, week completion, day states, time estimates. */
import type { Program, ProgramDay, WorkoutLog } from '../../../data/types'
import { dayFocus, restSeconds, warmupSetCount, workingSets } from '../../../data/programs'
import type { ISODate } from '../../../lib/dates'
import { refKey, scheduledDate, type WorkoutRef } from '../../../lib/stats'

export type Focus = 'str' | 'hyp'

/** "Pull (Hypertrophy Focus)" -> 'hyp', "Upper (Strength Focus)" -> 'str', anything else -> null. */
export function focusOf(day: Pick<ProgramDay, 'name'>): Focus | null {
  const f = dayFocus(day).toLowerCase()
  if (/strength|power|δύναμ/.test(f)) return 'str'
  if (/hypertroph|pump|volume|υπερτροφ/.test(f)) return 'hyp'
  return null
}

export interface BlockGroup {
  /** "Foundation Block" -> "Foundation" */
  label: string
  from: number
  to: number
}

/** Consecutive weeks sharing a block name (1-based week numbers). */
export function blockGroups(p: Program): BlockGroup[] {
  const out: BlockGroup[] = []
  p.weeks.forEach((w, i) => {
    const label = (w.block || '').replace(/\s*block\s*$/i, '').trim()
    const last = out[out.length - 1]
    if (last && last.label === label) last.to = i + 1
    else out.push({ label, from: i + 1, to: i + 1 })
  })
  return out
}

/** Done workouts of a program, as "w3d2" keys. */
export function doneKeys(logs: WorkoutLog[], programId: string): Set<string> {
  return new Set(logs.filter((l) => l.programId === programId && l.done).map((l) => refKey(l)))
}

/** Share of each week's workouts that are done (index 0 = week 1). */
export function weekCompletion(p: Program, done: Set<string>): number[] {
  return p.weeks.map((w, wi) => {
    const n = w.days.length
    if (!n) return 0
    let k = 0
    for (let d = 0; d < n; d++) if (done.has(refKey({ week: wi + 1, day: d }))) k++
    return k / n
  })
}

export type DayState = 'done' | 'today' | 'missed' | 'upcoming'

/** State of each workout day of a program week, for the week dots. */
export function weekDayStates(p: Program, start: ISODate | null, week: number, done: Set<string>, today: ISODate): DayState[] {
  const days = p.weeks[week - 1]?.days ?? []
  return days.map((_, d) => {
    const ref = { week, day: d }
    if (done.has(refKey(ref))) return 'done'
    if (!start) return 'upcoming'
    const date = scheduledDate(p, start, ref)
    if (date === today) return 'today'
    return date < today ? 'missed' : 'upcoming'
  })
}

/**
 * Rough session length in minutes, rounded to 5: every working set takes its rest's lower bound plus ~45 s
 * of work, and every warm-up set about a minute.
 */
export function estimateMinutes(day: ProgramDay): number {
  let sec = 0
  for (const e of day.ex) sec += workingSets(e) * (restSeconds(e.rest) + 45) + warmupSetCount(e) * 60
  return Math.max(5, Math.round(sec / 300) * 5)
}

export const totalSets = (day: ProgramDay): number => day.ex.reduce((a, e) => a + workingSets(e), 0)

/** Clamp a (possibly bogus) route ref to the program. */
export function clampRef(p: Program, week: number, day: number): WorkoutRef {
  const w = Math.min(p.weeks.length, Math.max(1, Math.floor(week) || 1))
  const days = p.weeks[w - 1]?.days.length ?? 1
  const d = Math.min(days - 1, Math.max(0, Math.floor(day) || 0))
  return { week: w, day: d }
}
