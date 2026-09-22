import type { Program, SetLog, Unit, WorkoutLog } from '../../data/types'
import { exerciseName, workingSets } from '../../data/programs'
import { isoFromMs, type ISODate } from '../dates'
import { parseNum, unitToKg } from '../units'

export type ProgramMap = Record<string, Program>

/** Epley estimated one-rep max. Reps are capped at 15 (beyond that the estimate is meaningless). */
export function e1rm(weightKg: number, reps: number): number {
  if (!(weightKg > 0) || !(reps > 0)) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + Math.min(reps, 15) / 30)
}

export const setKg = (s: SetLog, unit: Unit): number | null => {
  const n = parseNum(s.w)
  return n == null || n < 0 ? null : unitToKg(n, unit)
}
export const setReps = (s: SetLog): number | null => {
  const n = parseNum(s.r)
  return n == null || n <= 0 ? null : Math.round(n)
}

/** A set counts once ticked, or when the whole workout is marked done and the set has reps. */
export const isCountedSet = (s: SetLog, logDone: boolean): boolean => setReps(s) != null && (s.ok || logDone)

/** When a workout happened: finish time, else start, else last edit. */
export const logTime = (l: WorkoutLog): number => l.doneAt ?? l.startedAt ?? l.updatedAt
export const logDate = (l: WorkoutLog): ISODate => isoFromMs(logTime(l))

/** A log with at least one counted set (i.e. real training happened). */
export function isLogStarted(l: WorkoutLog): boolean {
  return Object.values(l.ex).some((e) => e.sets.some((s) => isCountedSet(s, l.done)))
}

export interface PerformedExercise {
  index: number
  name: string
  /** Name in the program (main exercise), even when a substitution was performed. */
  programName: string
  machine: string
  sets: { kg: number | null; reps: number; e1rmKg: number }[]
  bestE1rmKg: number
  volumeKg: number
  prescribedSets: number
}

/** Exercises actually performed in a log (counted sets only). */
export function performedExercises(l: WorkoutLog, p: Program | undefined): PerformedExercise[] {
  const day = p?.weeks[l.week - 1]?.days[l.day]
  if (!day) return []
  const out: PerformedExercise[] = []
  day.ex.forEach((e, i) => {
    const st = l.ex[String(i)]
    if (!st) return
    const sets = st.sets
      .filter((s) => isCountedSet(s, l.done))
      .map((s) => {
        const kg = setKg(s, l.unit)
        const reps = setReps(s) as number
        return { kg, reps, e1rmKg: kg ? e1rm(kg, reps) : 0 }
      })
    if (!sets.length) return
    out.push({
      index: i,
      name: exerciseName(e, st.v),
      programName: e.n,
      machine: st.m || '',
      sets,
      bestE1rmKg: Math.max(0, ...sets.map((s) => s.e1rmKg)),
      volumeKg: sets.reduce((a, s) => a + (s.kg ?? 0) * s.reps, 0),
      prescribedSets: workingSets(e),
    })
  })
  return out
}

export interface SessionSummary {
  exercises: number
  setsDone: number
  setsPrescribed: number
  reps: number
  volumeKg: number
  durationMs: number | null
}

export function sessionSummary(l: WorkoutLog, p: Program | undefined): SessionSummary {
  const perf = performedExercises(l, p)
  const day = p?.weeks[l.week - 1]?.days[l.day]
  const setTimes = Object.values(l.ex).flatMap((e) => e.sets.map((s) => s.at ?? 0)).filter(Boolean)
  const first = l.startedAt ?? (setTimes.length ? Math.min(...setTimes) : null)
  const last = l.doneAt ?? (setTimes.length ? Math.max(...setTimes) : null)
  return {
    exercises: perf.length,
    setsDone: perf.reduce((a, e) => a + e.sets.length, 0),
    setsPrescribed: day ? day.ex.reduce((a, e) => a + workingSets(e), 0) : 0,
    reps: perf.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.reps, 0), 0),
    volumeKg: perf.reduce((a, e) => a + e.volumeKg, 0),
    durationMs: first && last && last > first ? last - first : null,
  }
}

export interface ExercisePoint {
  logId: string
  date: ISODate
  at: number
  week: number
  day: number
  bestE1rmKg: number
  /** Heaviest counted set (ties broken by reps). */
  topSet: { kg: number; reps: number }
  volumeKg: number
  sets: { kg: number | null; reps: number }[]
  machine: string
}

/** Chronological history of one exercise (by performed name) across a member's logs. */
export function exerciseHistory(logs: WorkoutLog[], programs: ProgramMap, name: string): ExercisePoint[] {
  const pts: ExercisePoint[] = []
  for (const l of logs) {
    for (const pe of performedExercises(l, programs[l.programId])) {
      if (pe.name !== name) continue
      const top = pe.sets.reduce(
        (best, s) => ((s.kg ?? 0) > best.kg || ((s.kg ?? 0) === best.kg && s.reps > best.reps) ? { kg: s.kg ?? 0, reps: s.reps } : best),
        { kg: 0, reps: 0 },
      )
      pts.push({
        logId: l.id,
        date: logDate(l),
        at: logTime(l),
        week: l.week,
        day: l.day,
        bestE1rmKg: pe.bestE1rmKg,
        topSet: top,
        volumeKg: pe.volumeKg,
        sets: pe.sets.map((s) => ({ kg: s.kg, reps: s.reps })),
        machine: pe.machine,
      })
    }
  }
  return pts.sort((a, b) => a.at - b.at)
}

/** Every exercise name the member has performed, most frequent first. */
export function performedExerciseNames(logs: WorkoutLog[], programs: ProgramMap): string[] {
  const count = new Map<string, number>()
  for (const l of logs) for (const pe of performedExercises(l, programs[l.programId])) count.set(pe.name, (count.get(pe.name) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n)
}

export interface PR {
  memberId: string
  logId: string
  exercise: string
  date: ISODate
  at: number
  kg: number
  reps: number
  e1rmKg: number
  prevE1rmKg: number
}

/** Minimum improvement for a new PR (avoids "PRs" from rounding noise). */
const PR_EPS = 0.25

/**
 * Personal-record events in chronological order: a session whose best e1RM on an exercise beats every
 * earlier session's best. The first session of an exercise is its baseline, not a PR.
 */
export function personalRecords(logs: WorkoutLog[], programs: ProgramMap): PR[] {
  const sorted = [...logs].sort((a, b) => logTime(a) - logTime(b))
  const best = new Map<string, number>()
  const prs: PR[] = []
  for (const l of sorted) {
    for (const pe of performedExercises(l, programs[l.programId])) {
      if (!(pe.bestE1rmKg > 0)) continue
      const prev = best.get(pe.name)
      if (prev != null && pe.bestE1rmKg > prev + PR_EPS) {
        const top = pe.sets.reduce((a, s) => (s.e1rmKg > a.e1rmKg ? s : a), pe.sets[0])
        prs.push({
          memberId: l.memberId,
          logId: l.id,
          exercise: pe.name,
          date: logDate(l),
          at: logTime(l),
          kg: top.kg ?? 0,
          reps: top.reps,
          e1rmKg: pe.bestE1rmKg,
          prevE1rmKg: prev,
        })
      }
      if (prev == null || pe.bestE1rmKg > prev) best.set(pe.name, pe.bestE1rmKg)
    }
  }
  return prs
}

/** Best e1RM per exercise over the given logs, optionally excluding one log (the one being edited). */
export function bestE1rmByExercise(logs: WorkoutLog[], programs: ProgramMap, excludeLogId?: string): Map<string, number> {
  const best = new Map<string, number>()
  for (const l of logs) {
    if (l.id === excludeLogId) continue
    for (const pe of performedExercises(l, programs[l.programId])) {
      if (pe.bestE1rmKg > (best.get(pe.name) ?? 0)) best.set(pe.name, pe.bestE1rmKg)
    }
  }
  return best
}

/** Is this set a PR against the prior best e1RM? (Used live in the logger.) */
export function isPRSet(s: SetLog, unit: Unit, priorBestKg: number | undefined): boolean {
  if (!priorBestKg) return false
  const kg = setKg(s, unit)
  const reps = setReps(s)
  if (!kg || !reps) return false
  return e1rm(kg, reps) > priorBestKg + PR_EPS
}

/**
 * Average strength gain across exercises: best e1RM ever vs the first session's best, per exercise with at
 * least two sessions, averaged. null when there isn't enough data yet.
 */
export function strengthGain(logs: WorkoutLog[], programs: ProgramMap): { pct: number; exercises: number } | null {
  const first = new Map<string, number>()
  const best = new Map<string, number>()
  const sessions = new Map<string, number>()
  for (const l of [...logs].sort((a, b) => logTime(a) - logTime(b))) {
    for (const pe of performedExercises(l, programs[l.programId])) {
      if (!(pe.bestE1rmKg > 0)) continue
      if (!first.has(pe.name)) first.set(pe.name, pe.bestE1rmKg)
      best.set(pe.name, Math.max(best.get(pe.name) ?? 0, pe.bestE1rmKg))
      sessions.set(pe.name, (sessions.get(pe.name) ?? 0) + 1)
    }
  }
  const gains: number[] = []
  for (const [name, f] of first) if ((sessions.get(name) ?? 0) >= 2 && f > 0) gains.push((best.get(name)! - f) / f)
  if (!gains.length) return null
  return { pct: gains.reduce((a, b) => a + b, 0) / gains.length, exercises: gains.length }
}
