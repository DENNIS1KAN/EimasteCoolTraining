import type { Program, ProgramDay, ProgramExercise, ProgramWeek } from '../types'
import bts from './bts.json'

/** The 12-week program from the original BTS logbook (Foundation block weeks 1-5, Ramping block weeks 6-12). */
export const BTS_PROGRAM: Program = {
  id: 'bts-12',
  name: 'BTS · 12 weeks',
  description:
    'Upper/Lower + Push/Pull/Legs, 5 sessions a week. Foundation block (weeks 1-5) then Ramping block (weeks 6-12). Weeks 1 and 6 are intro weeks with lighter effort; after that the last set of every exercise goes to failure with the listed technique.',
  weeks: (bts as { weeks: ProgramWeek[] }).weeks,
  schedule: [0, 1, null, 2, 3, 4, null],
  builtIn: true,
  createdBy: null,
  updatedAt: 0,
}

export const BUILT_IN_PROGRAMS: Program[] = [BTS_PROGRAM]
export const DEFAULT_PROGRAM_ID = BTS_PROGRAM.id

/** "Upper (Strength Focus)" -> "Upper" */
export const dayShortName = (day: Pick<ProgramDay, 'name'>): string => day.name.split(' (')[0]
/** "Upper (Strength Focus)" -> "Strength Focus" */
export const dayFocus = (day: Pick<ProgramDay, 'name'>): string => (day.name.match(/\(([^)]+)\)/) || [, ''])[1] ?? ''

/** Name of the exercise actually performed for a variant (0 main, 1/2 substitutions). */
export function exerciseName(e: ProgramExercise, v: number | undefined): string {
  if (v === 1 && e.s1) return e.s1
  if (v === 2 && e.s2) return e.s2
  return e.n
}

/** Demo video for a variant. */
export function exerciseVideo(e: ProgramExercise, v: number | undefined): string | undefined {
  if (v === 1) return e.v1 || undefined
  if (v === 2) return e.v2 || undefined
  return e.v || undefined
}

/** Number of prescribed working sets (at least 1). */
export const workingSets = (e: ProgramExercise): number => Math.max(1, parseInt(e.s, 10) || 1)

/** Rest in seconds, from strings like "2-3 min" (uses the lower bound); 90 s when unknown. */
export function restSeconds(rest: string | undefined): number {
  const m = (rest || '').match(/(\d+(?:\.\d+)?)/)
  if (!m) return 90
  const n = parseFloat(m[1])
  return /s(ec)?\b/i.test(rest || '') && !/min/i.test(rest || '') ? Math.round(n) : Math.round(n * 60)
}

/** Number of warm-up sets to suggest (upper bound of "2-3", capped 1..4). */
export function warmupSetCount(e: ProgramExercise): number {
  const nums = (e.w.match(/\d+/g) || ['1']).map(Number)
  return Math.min(4, Math.max(1, ...nums))
}

/** Number of training days per week in the program (days of week 1). */
export const daysPerWeek = (p: Program): number => p.weeks[0]?.days.length ?? 0
/** Total workouts in the program. */
export const totalWorkouts = (p: Program): number => p.weeks.reduce((n, w) => n + w.days.length, 0)
