/** Read-only view model of a logged workout (MemberWorkoutPage). */
import type { Program, WorkoutLog } from '../../../data/types'
import { exerciseName, workingSets } from '../../../data/programs'
import { e1rm, performedExercises, personalRecords } from '../../../lib/stats'

export interface ViewSet {
  kg: number | null
  reps: number
  pr: boolean
  extra: boolean
}

export interface ViewExercise {
  index: number
  name: string
  /** 0 = main exercise, 1/2 = substitution. */
  v: number
  machine: string
  sets: ViewSet[]
  prescribed: number
  /** Nothing counted for this exercise. */
  skipped: boolean
}

/**
 * Every exercise of the program day with the sets that count (ticked, or with reps once the workout is done).
 * The best set of an exercise is marked as a PR when that session set a personal record on it
 * (chronological rule of `personalRecords`, so later sessions never take a PR away).
 */
export function workoutView(
  log: WorkoutLog | null,
  program: Program,
  week: number,
  day: number,
  memberLogs: WorkoutLog[],
  programs: Record<string, Program> = { [program.id]: program },
): ViewExercise[] {
  const pday = program.weeks[week - 1]?.days[day]
  if (!pday) return []
  const performed = log ? performedExercises(log, program) : []
  const prNames = log ? new Set(personalRecords(memberLogs, programs).filter((p) => p.logId === log.id).map((p) => p.exercise)) : new Set<string>()
  return pday.ex.map((e, i) => {
    const st = log?.ex[String(i)]
    const pe = performed.find((x) => x.index === i)
    const prescribed = workingSets(e)
    const sets = (pe?.sets ?? []).map((s, j) => ({ kg: s.kg, reps: s.reps, pr: false, extra: j >= prescribed }))
    if (pe && prNames.has(pe.name) && sets.length) {
      let best = 0
      sets.forEach((s, j) => {
        const a = s.kg ? e1rm(s.kg, s.reps) : 0
        const b = sets[best].kg ? e1rm(sets[best].kg!, sets[best].reps) : 0
        if (a > b) best = j
      })
      sets[best].pr = true
    }
    return { index: i, name: exerciseName(e, st?.v), v: st?.v ?? 0, machine: st?.m ?? '', sets, prescribed, skipped: !sets.length }
  })
}
