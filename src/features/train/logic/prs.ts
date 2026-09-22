import type { Program, WorkoutLog } from '../../../data/types'
import { performedExercises } from '../../../lib/stats'

/** Same threshold as the stats engine: an e1RM must beat the prior best by more than this to count. */
const PR_EPS = 0.25

export interface LogPR {
  exercise: string
  e1rmKg: number
  prevE1rmKg: number
  kg: number
  reps: number
}

/**
 * PRs set in one log against the member's prior bests (from `bestE1rmByExercise` excluding this log).
 * An exercise without a prior best is a baseline, not a PR (same rule as `personalRecords`).
 */
export function logPRs(log: WorkoutLog, program: Program | undefined, priorBest: Map<string, number>): LogPR[] {
  const out: LogPR[] = []
  for (const pe of performedExercises(log, program)) {
    const prev = priorBest.get(pe.name)
    if (!prev || !(pe.bestE1rmKg > prev + PR_EPS)) continue
    const top = pe.sets.reduce((a, s) => (s.e1rmKg > a.e1rmKg ? s : a), pe.sets[0])
    out.push({ exercise: pe.name, e1rmKg: pe.bestE1rmKg, prevE1rmKg: prev, kg: top.kg ?? 0, reps: top.reps })
  }
  return out
}
