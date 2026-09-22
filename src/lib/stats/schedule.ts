import type { Program, WorkoutLog } from '../../data/types'
import type { ISODate } from '../dates'
import { addDays, diffDays } from '../dates'

/** A workout slot in a program: week is 1-based, day is the 0-based index into that week's days. */
export interface WorkoutRef {
  week: number
  day: number
}

export const refKey = (r: WorkoutRef): string => `w${r.week}d${r.day}`
export const sameRef = (a: WorkoutRef | null | undefined, b: WorkoutRef | null | undefined): boolean =>
  !!a && !!b && a.week === b.week && a.day === b.day

/** All workouts of a program in training order. */
export function programWorkouts(p: Program): WorkoutRef[] {
  const out: WorkoutRef[] = []
  p.weeks.forEach((w, wi) => w.days.forEach((_, d) => out.push({ week: wi + 1, day: d })))
  return out
}

/** Schedule slot (0..6) on which a workout day is trained, falling back to spreading days evenly. */
function slotOfDay(p: Program, day: number): number {
  const idx = p.schedule.findIndex((s) => s === day)
  if (idx >= 0) return idx
  const n = Math.max(1, p.weeks[0]?.days.length ?? 1)
  return Math.min(6, Math.floor((day * 7) / n))
}

/** Calendar date on which a workout is scheduled, given the program start date (first day of week 1). */
export function scheduledDate(p: Program, start: ISODate, ref: WorkoutRef): ISODate {
  return addDays(start, (ref.week - 1) * 7 + slotOfDay(p, ref.day))
}

/** Number of workouts scheduled on or before `date`. */
export function workoutsDueBy(p: Program, start: ISODate, date: ISODate): number {
  if (date < start) return 0
  let n = 0
  for (const r of programWorkouts(p)) if (scheduledDate(p, start, r) <= date) n++
  return n
}

/** The workout scheduled on a date, or null for a rest day / outside the program. */
export function workoutOn(p: Program, start: ISODate, date: ISODate): WorkoutRef | null {
  const off = diffDays(start, date)
  if (off < 0) return null
  const week = Math.floor(off / 7) + 1
  if (week > p.weeks.length) return null
  const slot = off % 7
  const day = p.schedule[slot]
  if (day == null || day >= (p.weeks[week - 1]?.days.length ?? 0)) return null
  return { week, day }
}

/** Current program week (1-based) on a date: 0 before the start, capped at the last week. */
export function programWeekOn(p: Program, start: ISODate, date: ISODate): number {
  const off = diffDays(start, date)
  if (off < 0) return 0
  return Math.min(p.weeks.length, Math.floor(off / 7) + 1)
}

/** First workout (in training order) that is not done yet; null when the whole program is done. */
export function nextWorkout(p: Program, logs: WorkoutLog[]): WorkoutRef | null {
  const done = new Set(logs.filter((l) => l.programId === p.id && l.done).map((l) => refKey(l)))
  for (const r of programWorkouts(p)) if (!done.has(refKey(r))) return r
  return null
}

export interface ScheduleStatus {
  /** Workouts that should be done by the end of yesterday. */
  dueBeforeToday: number
  /** The workout planned for today (null on rest days). */
  today: WorkoutRef | null
  done: number
  /** How many scheduled workouts are missing (not counting today's). */
  behindBy: number
  /** How many more than scheduled (counting today's as due). */
  aheadBy: number
  /** Done / due, 0..1 (null until the first workout is due). */
  consistency: number | null
  started: boolean
  finished: boolean
}

export function scheduleStatus(p: Program, start: ISODate | null, logs: WorkoutLog[], today: ISODate): ScheduleStatus {
  const done = logs.filter((l) => l.programId === p.id && l.done).length
  const total = programWorkouts(p).length
  if (!start) {
    return { dueBeforeToday: 0, today: null, done, behindBy: 0, aheadBy: 0, consistency: null, started: false, finished: done >= total }
  }
  const dueBeforeToday = workoutsDueBy(p, start, addDays(today, -1))
  const dueToday = workoutsDueBy(p, start, today)
  const todayRef = workoutOn(p, start, today)
  // Today's workout only counts against you once the day is over, but counts for you as soon as it's done.
  const denominator = Math.max(dueBeforeToday, Math.min(done, dueToday))
  return {
    dueBeforeToday,
    today: todayRef,
    done,
    behindBy: Math.max(0, dueBeforeToday - done),
    aheadBy: Math.max(0, done - dueToday),
    consistency: denominator > 0 ? Math.min(1, done / denominator) : null,
    started: today >= start,
    finished: done >= total,
  }
}
