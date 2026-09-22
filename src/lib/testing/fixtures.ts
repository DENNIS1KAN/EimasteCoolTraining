/**
 * Hand-built fixtures for the lib unit tests. Importing this module pins the time zone to Europe/Athens
 * (DST: last Sunday of March 02:00 -> 03:00 and last Sunday of October 04:00 -> 03:00), so date tests run
 * the same everywhere and actually cross DST boundaries.
 */
import type {
  Cheer,
  CheckinRating,
  MealPlan,
  Member,
  NutritionCheckin,
  Program,
  ProgramExercise,
  Unit,
  WeightEntry,
  WorkoutLog,
} from '../../data/types'
import { dailyId, logId } from '../ids'
import type { ISODate } from '../dates'
import type { SquadData } from '../stats'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
if (env) env.TZ = 'Europe/Athens'

/** 2026 DST switches in Europe/Athens. */
export const DST_SPRING: ISODate = '2026-03-29'
export const DST_AUTUMN: ISODate = '2026-10-25'

/** Local wall-clock time on a calendar date, in ms. */
export function at(date: ISODate, hh = 18, mm = 0): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime()
}

const ex = (n: string, s: string, extra: Partial<ProgramExercise> = {}): ProgramExercise => ({
  n,
  t: 'N/A',
  w: '1',
  s,
  r: '8-10',
  e: '~7',
  l: '~8',
  rest: '2 min',
  ...extra,
})

function miniWeek(intro: boolean) {
  const t = intro ? 'N/A' : 'Failure'
  return {
    block: 'Base',
    intro,
    days: [
      { name: 'Upper (Strength)', ex: [ex('Bench Press', '2', { t, s1: 'DB Press', s2: 'Machine Press' }), ex('Row', '2', { t })] },
      { name: 'Lower (Strength)', ex: [ex('Squat', '3', { t, s1: 'Hack Squat' }), ex('Leg Curl', '2', { t })] },
      { name: 'Full (Pump)', ex: [ex('Pull-Up', '2', { t }), ex('Lateral Raise', '3', { t })] },
    ],
  }
}

/** 2 weeks x 3 days (Mon / Wed / Fri relative to the start date). */
export const MINI: Program = {
  id: 'mini',
  name: 'Mini',
  description: '',
  weeks: [miniWeek(true), miniWeek(false)],
  schedule: [0, null, 1, null, 2, null, null],
  builtIn: false,
  createdBy: null,
  updatedAt: 0,
}

export type SetSpec = [w: string, r: string, ok?: boolean]
export interface LogSpec {
  member?: string
  program?: Program
  week: number
  day: number
  done?: boolean
  doneAt?: number | null
  startedAt?: number | null
  updatedAt?: number
  unit?: Unit
  feel?: number | null
  note?: string
  ex?: Record<number, { v?: 0 | 1 | 2; m?: string; sets: SetSpec[] }>
}

export function mkLog(s: LogSpec): WorkoutLog {
  const member = s.member ?? 'stelios'
  const program = s.program ?? MINI
  const done = s.done ?? true
  const exLogs: WorkoutLog['ex'] = {}
  for (const [k, e] of Object.entries(s.ex ?? {})) {
    exLogs[k] = { v: e.v ?? 0, m: e.m ?? '', sets: e.sets.map(([w, r, ok]) => ({ w, r, ok: ok ?? true })) }
  }
  const doneAt = s.doneAt === undefined ? (done ? at('2026-01-05') : null) : s.doneAt
  return {
    id: logId(member, program.id, s.week, s.day),
    memberId: member,
    programId: program.id,
    week: s.week,
    day: s.day,
    unit: s.unit ?? 'kg',
    ex: exLogs,
    done,
    doneAt,
    startedAt: s.startedAt ?? null,
    feel: s.feel ?? null,
    note: s.note ?? '',
    updatedAt: s.updatedAt ?? doneAt ?? 1,
  }
}

export function mkMember(p: Partial<Member> & Pick<Member, 'id'>): Member {
  return {
    slug: p.id,
    name: p.id[0].toUpperCase() + p.id.slice(1),
    role: 'athlete',
    color: 'blue',
    competes: true,
    goal: '',
    goalWeightKg: null,
    heightCm: null,
    programId: MINI.id,
    programStart: null,
    coachNote: '',
    coachNoteAt: null,
    settings: { unit: 'kg', machines: {}, weightVisibility: 'exact' },
    joined: true,
    updatedAt: 1,
    ...p,
  }
}

export function mkWeight(memberId: string, date: ISODate, kg: number): WeightEntry {
  return { id: dailyId(memberId, date), memberId, date, kg, bodyFat: null, waistCm: null, note: '', updatedAt: at(date, 7) }
}

export function mkPlan(p: Partial<MealPlan> & Pick<MealPlan, 'id' | 'memberId' | 'startDate'>): MealPlan {
  return {
    title: 'Plan',
    notes: '',
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
    waterL: null,
    meals: [],
    files: [],
    active: false,
    createdBy: 'dennis',
    createdAt: at(p.startDate, 9),
    updatedAt: at(p.startDate, 9),
    ...p,
  }
}

export const meals = (...ids: string[]): MealPlan['meals'] =>
  ids.map((id) => ({ id, name: id, time: '', items: '', kcal: null, protein: null }))

export function mkCheckin(
  memberId: string,
  date: ISODate,
  p: { meals?: string[]; rating?: CheckinRating | null; planId?: string | null } = {},
): NutritionCheckin {
  return {
    id: dailyId(memberId, date),
    memberId,
    date,
    planId: p.planId ?? null,
    meals: p.meals ?? [],
    rating: p.rating ?? null,
    waterL: null,
    note: '',
    updatedAt: at(date, 21),
  }
}

let cheerSeq = 0
export function mkCheer(p: Partial<Cheer> & Pick<Cheer, 'fromId' | 'toId' | 'kind' | 'createdAt'>): Cheer {
  cheerSeq++
  return { id: `c${cheerSeq}`, ref: null, emoji: '🔥', text: '', seenAt: null, updatedAt: p.createdAt, ...p }
}

const byId = <T extends { id: string }>(rows: T[] = []): Record<string, T> => Object.fromEntries(rows.map((r) => [r.id, r]))

export function squad(p: {
  members?: Member[]
  programs?: Program[]
  logs?: WorkoutLog[]
  weights?: WeightEntry[]
  mealPlans?: MealPlan[]
  checkins?: NutritionCheckin[]
  cheers?: Cheer[]
}): SquadData {
  return {
    members: byId(p.members),
    programs: byId(p.programs ?? [MINI]),
    logs: byId(p.logs),
    weights: byId(p.weights),
    mealPlans: byId(p.mealPlans),
    checkins: byId(p.checkins),
    cheers: byId(p.cheers),
  }
}
