/**
 * Pure workout-log edits used by the logger. Every function returns a new log (never mutates) so the page can
 * hand the result straight to `put('logs', …)`.
 */
import type { ExerciseLog, MemberSettings, ProgramDay, ProgramExercise, SetLog, Unit, WorkoutLog } from '../../../data/types'
import { exerciseName, workingSets } from '../../../data/programs'
import { logId } from '../../../lib/ids'
import { parseNum } from '../../../lib/units'
import { fromISODate, isoFromMs, type ISODate } from '../../../lib/dates'
import { isCountedSet, setReps } from '../../../lib/stats'

export type Machines = Record<string, string>

export const emptySet = (): SetLog => ({ w: '', r: '', ok: false, at: null })

export function emptyLog(memberId: string, programId: string, week: number, day: number, unit: Unit): WorkoutLog {
  return {
    id: logId(memberId, programId, week, day),
    memberId,
    programId,
    week,
    day,
    unit,
    ex: {},
    done: false,
    doneAt: null,
    startedAt: null,
    feel: null,
    note: '',
    updatedAt: 0,
  }
}

/**
 * Exercise `i` as shown in the logger: the stored entry, or defaults (main variant, the remembered machine and
 * the prescribed number of empty sets). Stored entries are padded up to the prescribed sets.
 */
export function exerciseLog(log: WorkoutLog | null | undefined, i: number, e: ProgramExercise, machines: Machines): ExerciseLog {
  return exerciseFrom(log?.ex[String(i)], e, machines)
}

/** Same as exerciseLog, from the stored entry itself (lets memoized cards depend on one exercise only). */
export function exerciseFrom(cur: ExerciseLog | undefined, e: ProgramExercise, machines: Machines): ExerciseLog {
  const v = cur?.v ?? 0
  const n = workingSets(e)
  const sets = cur?.sets ?? []
  return {
    v,
    m: cur ? cur.m : (machines[exerciseName(e, v)] ?? ''),
    sets: sets.length >= n ? sets : [...sets, ...Array.from({ length: n - sets.length }, emptySet)],
  }
}

/** Replace exercise `i`; `start` stamps `startedAt` on the first real edit (sets, not setup like machines). */
function withExercise(
  log: WorkoutLog,
  i: number,
  e: ProgramExercise,
  machines: Machines,
  fn: (x: ExerciseLog) => ExerciseLog,
  start: { now: number } | null,
): WorkoutLog {
  const next: WorkoutLog = { ...log, ex: { ...log.ex, [String(i)]: fn(exerciseLog(log, i, e, machines)) } }
  if (start && !next.startedAt && !next.done) next.startedAt = start.now
  return next
}

const replaceSet = (x: ExerciseLog, j: number, s: SetLog): ExerciseLog => ({ ...x, sets: x.sets.map((y, k) => (k === j ? s : y)) })

/** Type into a set's weight or reps. */
export function setField(
  log: WorkoutLog,
  i: number,
  e: ProgramExercise,
  j: number,
  field: 'w' | 'r',
  value: string,
  machines: Machines,
  now: number,
): WorkoutLog {
  return withExercise(log, i, e, machines, (x) => (x.sets[j] ? replaceSet(x, j, { ...x.sets[j], [field]: value }) : x), { now })
}

export interface Placeholder {
  w: string
  r: string
}

export type TickResult = 'ticked' | 'unticked' | 'need-reps'

/**
 * The set-done check. Ticking an empty set reuses last time's numbers (the placeholders). When the reps are
 * still missing the set is not ticked ('need-reps': focus the reps input), but a missing weight is filled in.
 */
export function tickSet(
  log: WorkoutLog,
  i: number,
  e: ProgramExercise,
  j: number,
  placeholder: Placeholder | null,
  machines: Machines,
  now: number,
): { log: WorkoutLog; result: TickResult } {
  const x = exerciseLog(log, i, e, machines)
  const s = x.sets[j]
  if (!s) return { log, result: 'need-reps' }
  if (s.ok) return { log: withExercise(log, i, e, machines, (y) => replaceSet(y, j, { ...s, ok: false, at: null }), { now }), result: 'unticked' }
  const w = s.w.trim() || placeholder?.w || ''
  const r = s.r.trim() || placeholder?.r || ''
  const reps = parseNum(r)
  if (reps == null || Math.round(reps) <= 0) {
    const filled = w !== s.w ? withExercise(log, i, e, machines, (y) => replaceSet(y, j, { ...s, w }), { now }) : log
    return { log: filled, result: 'need-reps' }
  }
  return { log: withExercise(log, i, e, machines, (y) => replaceSet(y, j, { w, r, ok: true, at: now }), { now }), result: 'ticked' }
}

/** Add an extra set beyond the prescription. */
export function addSet(log: WorkoutLog, i: number, e: ProgramExercise, machines: Machines): WorkoutLog {
  return withExercise(log, i, e, machines, (x) => ({ ...x, sets: [...x.sets, emptySet()] }), null)
}

/** Remove the last extra set (prescribed sets stay). */
export function removeSet(log: WorkoutLog, i: number, e: ProgramExercise, machines: Machines): WorkoutLog {
  const x = exerciseLog(log, i, e, machines)
  if (x.sets.length <= workingSets(e)) return log
  return withExercise(log, i, e, machines, (y) => ({ ...y, sets: y.sets.slice(0, -1) }), null)
}

/** Switch to the main exercise (0) or a substitution (1/2); the machine follows the new exercise. */
export function setVariant(log: WorkoutLog, i: number, e: ProgramExercise, v: 0 | 1 | 2, machines: Machines): WorkoutLog {
  return withExercise(log, i, e, machines, (x) => ({ ...x, v, m: machines[exerciseName(e, v)] ?? '' }), null)
}

export function setMachine(log: WorkoutLog, i: number, e: ProgramExercise, m: string, machines: Machines): WorkoutLog {
  return withExercise(log, i, e, machines, (x) => ({ ...x, m }), null)
}

/** Remember (or forget, when empty) the machine for an exercise name in the member's settings. */
export function rememberMachine(settings: MemberSettings, name: string, machine: string): MemberSettings {
  const m = machine.trim()
  const machines = { ...settings.machines }
  if (m) machines[name] = m
  else delete machines[name]
  return { ...settings, machines }
}

/** Distinct machines the member has used, most used first (for suggestions). */
export function machineSuggestions(settings: MemberSettings, logs: WorkoutLog[]): string[] {
  const count = new Map<string, number>()
  const add = (m: string, n = 1) => {
    const k = m.trim()
    if (k) count.set(k, (count.get(k) ?? 0) + n)
  }
  for (const m of Object.values(settings.machines)) add(m, 2)
  for (const l of logs) for (const x of Object.values(l.ex)) add(x.m)
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([m]) => m)
}

/**
 * When a workout finished on `date`: now if that's today, else the last set ticked that day, else its start that
 * day, else local noon (for a session marked done after the fact).
 */
export function doneAtFor(date: ISODate, log: WorkoutLog, now: number): number {
  if (date === isoFromMs(now)) return now
  const times = Object.values(log.ex).flatMap((x) => x.sets.map((s) => s.at ?? 0)).filter((at) => at && isoFromMs(at) === date)
  if (times.length) return Math.max(...times)
  if (log.startedAt && isoFromMs(log.startedAt) === date) return log.startedAt
  return fromISODate(date).getTime()
}

/** Sets with reps that aren't ticked (they count once the workout is marked done). */
export function openSetsWithReps(log: WorkoutLog | null | undefined): number {
  if (!log) return 0
  let n = 0
  for (const x of Object.values(log.ex)) for (const s of x.sets) if (!s.ok && setReps(s) != null) n++
  return n
}

export function finishLog(log: WorkoutLog, p: { doneAt: number; feel: number | null; note: string }): WorkoutLog {
  return { ...log, done: true, doneAt: p.doneAt, feel: p.feel, note: p.note }
}

export function unfinishLog(log: WorkoutLog): WorkoutLog {
  return { ...log, done: false, doneAt: null }
}

/* ------------------------------------------------------------------ progress */

export interface ExerciseProgress {
  /** Ticked sets (extra sets included). */
  done: number
  /** Rows shown: prescribed sets plus extra ones. */
  total: number
  prescribed: number
  complete: boolean
}

export interface DayProgress {
  exercises: ExerciseProgress[]
  /** Ticked sets counted against the prescription (at most the prescribed sets of each exercise). */
  setsDone: number
  /** Prescribed sets of the day (the one denominator used everywhere: logger, Home, finish sheet, done card). */
  setsTotal: number
  /** Ticked sets beyond the prescription, shown apart as "+N". */
  setsExtra: number
  /** First exercise that isn't complete, -1 when all are. */
  current: number
}

export function dayProgress(log: WorkoutLog | null | undefined, day: ProgramDay): DayProgress {
  const exercises = day.ex.map((e, i) => {
    const sets = log?.ex[String(i)]?.sets ?? []
    const prescribed = workingSets(e)
    const done = sets.filter((s) => s.ok).length
    return { done, total: Math.max(prescribed, sets.length), prescribed, complete: done >= prescribed }
  })
  return {
    exercises,
    setsDone: exercises.reduce((a, x) => a + Math.min(x.done, x.prescribed), 0),
    setsTotal: exercises.reduce((a, x) => a + x.prescribed, 0),
    setsExtra: exercises.reduce((a, x) => a + Math.max(0, x.done - x.prescribed), 0),
    current: exercises.findIndex((x) => !x.complete),
  }
}

export interface SetTally {
  /** Counted sets, at most the prescribed ones per exercise. */
  done: number
  prescribed: number
  /** Counted sets beyond the prescription. */
  extra: number
}

/**
 * Sets done against the prescription for a whole workout, counting the way the stats do (ticked sets, plus
 * sets with reps once the workout is done). Extra sets are counted apart, so "sets done" never reads 15 / 14.
 */
export function setTally(log: WorkoutLog | null | undefined, day: ProgramDay | undefined): SetTally {
  const t: SetTally = { done: 0, prescribed: 0, extra: 0 }
  if (!day) return t
  day.ex.forEach((e, i) => {
    const prescribed = workingSets(e)
    const n = (log?.ex[String(i)]?.sets ?? []).filter((s) => isCountedSet(s, !!log?.done)).length
    t.prescribed += prescribed
    t.done += Math.min(n, prescribed)
    t.extra += Math.max(0, n - prescribed)
  })
  return t
}

export type NextUp =
  | { kind: 'set'; exercise: number; set: number; last: boolean }
  | { kind: 'exercise'; exercise: number }
  | { kind: 'done' }

/**
 * What comes after ticking set `j` of exercise `i`: the next open set of the same exercise, else the next
 * exercise with open sets (wrapping around to skipped ones), else done.
 */
export function nextUp(log: WorkoutLog, day: ProgramDay, i: number, machines: Machines): NextUp {
  const x = exerciseLog(log, i, day.ex[i], machines)
  const open = x.sets.findIndex((s) => !s.ok)
  if (open >= 0) return { kind: 'set', exercise: i, set: open, last: open === x.sets.length - 1 }
  const n = day.ex.length
  for (let k = 1; k < n; k++) {
    const idx = (i + k) % n
    const y = exerciseLog(log, idx, day.ex[idx], machines)
    if (y.sets.some((s) => !s.ok)) return { kind: 'exercise', exercise: idx }
  }
  return { kind: 'done' }
}
