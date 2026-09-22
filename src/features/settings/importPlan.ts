import type { WorkoutLog } from '../../data/types'
import { addDays, isoFromMs, startOfWeek, type ISODate } from '../../lib/dates'

/** What an imported logbook file contains, for the preview before anything is written. */
export interface ImportSummary {
  workouts: number
  /** Finished workouts. */
  finished: number
  /** Sets with a weight, reps or a tick. */
  sets: number
  /** Imported workouts that already exist on the account (same member, program, week and day). */
  existing: number
  firstDate: ISODate | null
  lastDate: ISODate | null
  /** Highest program week in the file. */
  lastWeek: number
}

const hasContent = (s: { w: string; r: string; ok: boolean }) => !!(s.w || s.r || s.ok)

export function summarizeImport(logs: readonly WorkoutLog[], existing: Readonly<Record<string, WorkoutLog>>): ImportSummary {
  let sets = 0
  let finished = 0
  let exists = 0
  let lastWeek = 0
  const dates: ISODate[] = []
  for (const l of logs) {
    for (const x of Object.values(l.ex)) sets += x.sets.filter(hasContent).length
    if (l.done) finished++
    if (existing[l.id]) exists++
    if (l.doneAt != null) dates.push(isoFromMs(l.doneAt))
    lastWeek = Math.max(lastWeek, l.week)
  }
  dates.sort()
  return {
    workouts: logs.length,
    finished,
    sets,
    existing: exists,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    lastWeek,
  }
}

/** The logs to write: new ones always, ones that already exist only when `overwrite` is on. */
export function logsToWrite(logs: readonly WorkoutLog[], existing: Readonly<Record<string, WorkoutLog>>, overwrite: boolean): WorkoutLog[] {
  return logs.filter((l) => overwrite || !existing[l.id])
}

/**
 * A program start date that fits the imported history: the Monday of the earliest finished workout's
 * calendar week, moved back by its program week. Null when nothing was finished.
 */
export function inferProgramStart(logs: readonly WorkoutLog[]): ISODate | null {
  let best: { date: ISODate; week: number } | null = null
  for (const l of logs) {
    if (!l.done || l.doneAt == null) continue
    const date = isoFromMs(l.doneAt)
    if (!best || date < best.date) best = { date, week: l.week }
  }
  if (!best) return null
  return addDays(startOfWeek(best.date), -7 * (best.week - 1))
}
