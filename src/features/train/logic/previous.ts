/**
 * "Last time" for the logger: the previous performance of an exercise, shown as grey placeholders in the set
 * inputs and in the "Last time · Week 2: 55 × 10, 55 × 9" row.
 */
import type { Program, ProgramDay, SetLog, Unit, WorkoutLog } from '../../../data/types'
import { exerciseName } from '../../../data/programs'
import { isCountedSet, logTime, setReps } from '../../../lib/stats'
import { kgToUnit, parseNum, unitToKg } from '../../../lib/units'
import type { Placeholder } from './log'

export interface PrevSet extends Placeholder {
  /** Weight in the target unit (null = bodyweight / not entered). */
  weight: number | null
  reps: number
}

export interface PrevPerformance {
  logId: string
  programId: string
  week: number
  day: number
  /** When it happened (ms). */
  at: number
  sets: PrevSet[]
}

interface Entry {
  log: WorkoutLog
  exIndex: number
}

/** Performed exercises of a member's logs, by performed name (built once; cheap to query per exercise). */
export type HistoryIndex = Map<string, Entry[]>

export function buildHistoryIndex(logs: WorkoutLog[], programs: Record<string, Program>): HistoryIndex {
  const index: HistoryIndex = new Map()
  for (const log of logs) {
    const day = programs[log.programId]?.weeks[log.week - 1]?.days[log.day]
    if (!day) continue
    day.ex.forEach((e, i) => {
      const st = log.ex[String(i)]
      if (!st || !st.sets.some((s) => isCountedSet(s, log.done))) return
      const name = exerciseName(e, st.v)
      const list = index.get(name)
      if (list) list.push({ log, exIndex: i })
      else index.set(name, [{ log, exIndex: i }])
    })
  }
  return index
}

const order = (l: { week: number; day: number }) => l.week * 1000 + l.day

/** A typed weight converted between units, written the way people type it ("57.5", "126.5"). */
export function convertWeight(w: string, from: Unit, to: Unit): string {
  if (from === to) return w.trim()
  const n = parseNum(w)
  if (n == null) return ''
  const v = kgToUnit(unitToKg(n, from), to)
  return String(Math.round(v * 2) / 2)
}

/**
 * The most relevant earlier performance of `name` for the workout being logged:
 * 1. the same day slot of the most recent earlier week of the same program (same rep range, same position);
 * 2. otherwise the latest earlier session anywhere (earlier in program order, or from another program).
 * Later sessions of the same program are never used (browsing week 1 after week 2 shows no "last time").
 */
export function previousPerformance(
  index: HistoryIndex,
  current: { id: string; programId: string; week: number; day: number },
  name: string,
  unit: Unit,
): PrevPerformance | null {
  const entries = (index.get(name) ?? []).filter((x) => x.log.id !== current.id)
  const earlier = entries.filter((x) => x.log.programId !== current.programId || order(x.log) < order(current))
  if (!earlier.length) return null
  const sameSlot = earlier
    .filter((x) => x.log.programId === current.programId && x.log.day === current.day)
    .sort((a, b) => b.log.week - a.log.week)[0]
  const pick = sameSlot ?? [...earlier].sort((a, b) => logTime(b.log) - logTime(a.log))[0]
  const { log, exIndex } = pick
  const sets = log.ex[String(exIndex)].sets
    .filter((s) => isCountedSet(s, log.done))
    .map((s) => {
      const w = convertWeight(s.w, log.unit, unit)
      const n = parseNum(w)
      const reps = setReps(s) ?? 0
      return { w, r: String(reps), weight: n != null && n > 0 ? n : null, reps }
    })
  return { logId: log.id, programId: log.programId, week: log.week, day: log.day, at: logTime(log), sets }
}

/**
 * Placeholder for set `j`: last time's set j (or its last set for extra sets). Without a previous performance,
 * a later set suggests the weight typed in the set above (people rarely change the load between sets).
 */
export function placeholderFor(prev: PrevPerformance | null, j: number, above: { w: string } | undefined): Placeholder | null {
  const p = prev?.sets.length ? (prev.sets[j] ?? prev.sets[prev.sets.length - 1]) : null
  if (p) return { w: p.w, r: p.r }
  const w = above?.w.trim() ?? ''
  return w ? { w, r: '' } : null
}

/**
 * Placeholders for all set rows of an exercise. Without a previous performance, a set suggests the weight of the
 * set above, typed or itself suggested (so 50 typed in set 1 shows as the grey weight of sets 2 and 3).
 */
export function placeholdersFor(prev: PrevPerformance | null, sets: SetLog[]): (Placeholder | null)[] {
  const out: (Placeholder | null)[] = []
  sets.forEach((_, j) => {
    const above = j > 0 ? { w: sets[j - 1].w.trim() || out[j - 1]?.w || '' } : undefined
    out.push(placeholderFor(prev, j, above))
  })
  return out
}

/**
 * Before a workout is finished: un-ticked sets that have reps but no weight take the grey placeholder weight,
 * exactly like ticking them would have. Otherwise reps typed under a grey 67.5 would be stored as a bodyweight
 * set (no volume, no e1RM, and "— × 10" as next time's placeholder). `prevs` is indexed like the day's exercises.
 */
export function fillPlaceholderWeights(log: WorkoutLog, day: ProgramDay, prevs: readonly (PrevPerformance | null)[]): WorkoutLog {
  let ex: WorkoutLog['ex'] | null = null
  for (const [k, x] of Object.entries(log.ex)) {
    if (!day.ex[Number(k)]) continue
    const ph = placeholdersFor(prevs[Number(k)] ?? null, x.sets)
    let changed = false
    const sets = x.sets.map((s, j) => {
      if (s.ok || s.w.trim() || !setReps(s) || !ph[j]?.w) return s
      changed = true
      return { ...s, w: ph[j]!.w }
    })
    if (changed) (ex ??= { ...log.ex })[k] = { ...x, sets }
  }
  return ex ? { ...log, ex } : log
}
