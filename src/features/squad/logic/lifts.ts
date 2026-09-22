import type { WorkoutLog } from '../../../data/types'
import { logTime, performedExercises, type ProgramMap } from '../../../lib/stats'

export interface TopLift {
  name: string
  bestE1rmKg: number
  /** The set that produced the best e1RM. */
  kg: number
  reps: number
  /** When the best was set (ms). */
  at: number
  sessions: number
}

/** Best estimated 1RM per exercise, strongest first. */
export function topLifts(logs: WorkoutLog[], programs: ProgramMap, limit = 6): TopLift[] {
  const map = new Map<string, TopLift>()
  for (const l of logs) {
    for (const pe of performedExercises(l, programs[l.programId])) {
      if (!(pe.bestE1rmKg > 0)) continue
      const top = pe.sets.reduce((a, s) => (s.e1rmKg > a.e1rmKg ? s : a), pe.sets[0])
      const cur = map.get(pe.name)
      if (!cur) map.set(pe.name, { name: pe.name, bestE1rmKg: pe.bestE1rmKg, kg: top.kg ?? 0, reps: top.reps, at: logTime(l), sessions: 1 })
      else {
        cur.sessions++
        if (pe.bestE1rmKg > cur.bestE1rmKg) Object.assign(cur, { bestE1rmKg: pe.bestE1rmKg, kg: top.kg ?? 0, reps: top.reps, at: logTime(l) })
      }
    }
  }
  return [...map.values()].sort((a, b) => b.bestE1rmKg - a.bestE1rmKg || a.name.localeCompare(b.name)).slice(0, limit)
}

/** Finished workouts, newest first. */
export function recentWorkouts(logs: WorkoutLog[], limit = 5): WorkoutLog[] {
  return logs
    .filter((l) => l.done)
    .sort((a, b) => logTime(b) - logTime(a))
    .slice(0, limit)
}
