/** What the Home screen's workout hero should say today (pure, so every state is tested). */
import type { Member, Program, WorkoutLog } from '../../../data/types'
import { addDays, diffDays, type ISODate } from '../../../lib/dates'
import { isCountedSet, logDate, logTime, nextWorkout, programWeekOn, scheduleStatus, scheduledDate, type WorkoutRef } from '../../../lib/stats'

/** A session started this long ago and never finished is no longer "in progress". */
export const STALE_SESSION_MS = 12 * 60 * 60 * 1000

export type TodayState =
  | { kind: 'no-program' }
  /** programStart is null: pick a start date. `next` is the first workout, for "preview". */
  | { kind: 'not-started'; next: WorkoutRef }
  | { kind: 'starts-soon'; start: ISODate; inDays: number; next: WorkoutRef }
  | { kind: 'in-progress'; ref: WorkoutRef; log: WorkoutLog }
  | { kind: 'done-today'; ref: WorkoutRef; log: WorkoutLog; next: WorkoutRef | null; nextDate: ISODate | null }
  | { kind: 'train'; ref: WorkoutRef; scheduledToday: boolean; behindBy: number }
  | { kind: 'rest'; next: WorkoutRef; nextDate: ISODate | null }
  | { kind: 'complete'; done: number }

export interface TodayInput {
  member: Pick<Member, 'programStart'> | null
  program: Program | null
  /** The member's logs for this program. */
  logs: WorkoutLog[]
  today: ISODate
  now: number
}

/** The in-progress session: the latest unfinished log started (or edited) within the last 12 hours. */
export function liveLog(logs: WorkoutLog[], now: number): WorkoutLog | null {
  let best: WorkoutLog | null = null
  for (const l of logs) {
    if (l.done) continue
    const started = l.startedAt ?? (Object.values(l.ex).some((e) => e.sets.some((s) => isCountedSet(s, false))) ? l.updatedAt : null)
    if (started == null || now - Math.max(started, l.updatedAt) > STALE_SESSION_MS) continue
    if (!best || logTime(l) > logTime(best)) best = l
  }
  return best
}

export function todayState({ member, program, logs, today, now }: TodayInput): TodayState {
  if (!program || !program.weeks.length) return { kind: 'no-program' }
  const mine = logs.filter((l) => l.programId === program.id)
  const start = member?.programStart ?? null
  const live = liveLog(mine, now)
  if (live) return { kind: 'in-progress', ref: { week: live.week, day: live.day }, log: live }

  const next = nextWorkout(program, mine)
  const doneToday = mine.filter((l) => l.done && logDate(l) === today).sort((a, b) => logTime(b) - logTime(a))[0]
  if (doneToday) {
    return {
      kind: 'done-today',
      ref: { week: doneToday.week, day: doneToday.day },
      log: doneToday,
      next,
      nextDate: next && start ? nextTrainingDate(program, start, next, addDays(today, 1)) : null,
    }
  }
  if (!next) return { kind: 'complete', done: mine.filter((l) => l.done).length }
  if (!start) return { kind: 'not-started', next }
  if (start > today) return { kind: 'starts-soon', start, inDays: diffDays(today, start), next }

  const st = scheduleStatus(program, start, mine, today)
  if (st.behindBy > 0) return { kind: 'train', ref: next, scheduledToday: !!st.today, behindBy: st.behindBy }
  const todayDone = st.today ? mine.some((l) => l.done && l.week === st.today!.week && l.day === st.today!.day) : true
  if (st.today && !todayDone) return { kind: 'train', ref: next, scheduledToday: true, behindBy: 0 }
  return { kind: 'rest', next, nextDate: nextTrainingDate(program, start, next, addDays(today, 1)) }
}

/**
 * When the next workout will be trained: its scheduled date, or (when you're ahead of schedule) the next
 * training day on or after `from`.
 */
export function nextTrainingDate(p: Program, start: ISODate, next: WorkoutRef, from: ISODate): ISODate {
  const sched = scheduledDate(p, start, next)
  if (sched >= from) return sched
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i)
    const slot = ((diffDays(start, d) % 7) + 7) % 7
    if (p.schedule[slot] != null) return d
  }
  return from
}

/** The program week whose dots the hero shows: the calendar week, or the next workout's week before the start. */
export function heroWeek(p: Program, start: ISODate | null, today: ISODate, fallback: WorkoutRef | null): number {
  if (start && today >= start) return programWeekOn(p, start, today)
  return fallback?.week ?? 1
}
