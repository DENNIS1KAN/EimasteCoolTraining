import type { Program, WorkoutLog } from '../../../data/types'
import { dayShortName } from '../../../data/programs'
import type { ISODate } from '../../../lib/dates'
import { programWeekOn, scheduledDate } from '../../../lib/stats'
import type { SquadData } from '../../../lib/stats'

export type DotState = 'done' | 'today' | 'upcoming' | 'missed'

export interface WeekDot {
  /** One letter: U, L, P, P, L */
  label: string
  /** Full workout name for accessible text ("Upper"). */
  name: string
  state: DotState
  week: number
  day: number
}

/**
 * The member's current program week as dots, one per workout: done, today (scheduled today, not done yet),
 * missed (scheduled earlier, not done) or upcoming. Before the start date it previews week 1 as upcoming.
 */
export function programWeekDots(program: Program, start: ISODate | null, logs: WorkoutLog[], today: ISODate): WeekDot[] {
  const started = !!start && start <= today
  const week = started ? Math.max(1, programWeekOn(program, start!, today)) : 1
  const days = program.weeks[week - 1]?.days ?? []
  const done = new Set(logs.filter((l) => l.done && l.programId === program.id && l.week === week).map((l) => l.day))
  return days.map((d, day) => {
    const name = dayShortName(d)
    let state: DotState = 'upcoming'
    if (done.has(day)) state = 'done'
    else if (started) {
      const date = scheduledDate(program, start!, { week, day })
      if (date === today) state = 'today'
      else if (date < today) state = 'missed'
    }
    return { label: (name.trim()[0] ?? '?').toUpperCase(), name, state, week, day }
  })
}

/** Most recent sign of life: a logged set or workout, a weigh-in, a food check-in or a cheer sent. */
export function lastActiveAt(d: Pick<SquadData, 'logs' | 'weights' | 'checkins' | 'cheers'>, memberId: string): number | null {
  let last = 0
  const bump = (t: number | null | undefined) => {
    if (t != null && Number.isFinite(t) && t > last) last = t
  }
  for (const l of Object.values(d.logs)) if (l.memberId === memberId) bump(l.doneAt ?? l.updatedAt)
  for (const w of Object.values(d.weights)) if (w.memberId === memberId) bump(w.updatedAt)
  for (const c of Object.values(d.checkins)) if (c.memberId === memberId) bump(c.updatedAt)
  for (const c of Object.values(d.cheers)) if (c.fromId === memberId) bump(c.createdAt)
  return last > 0 ? last : null
}
