/**
 * Import / export of training programs.
 *
 * parseProgram accepts
 *  (a) the original logbook JSON: { "1": { block, days: [{ name, ex: [...] }] }, "2": ... } keyed by week,
 *  (b) { weeks: [...] }, a full Program object, or a bare array of weeks,
 *  (c) CSV with the PROGRAM_CSV_COLUMNS header (case-insensitive, any order, extra columns ignored),
 *      one row per exercise, rows of a day consecutive (the template from programTemplateCSV).
 * Exercises may use the compact program keys (n, t, w, ...) or the CSV column names (exercise, technique, ...).
 */
import type { Program, ProgramExercise, ProgramWeek } from '../../data/types'
import { BTS_PROGRAM } from '../../data/programs'
import { uuid } from '../ids'
import { headerIndex, isBlankRow, normalizeHeader, parseCSV, toCSV, type Delimiter } from './csv'

export const PROGRAM_CSV_COLUMNS = [
  'week',
  'block',
  'day',
  'exercise',
  'technique',
  'warmup_sets',
  'working_sets',
  'reps',
  'early_rpe',
  'last_rpe',
  'rest',
  'sub1',
  'sub2',
  'notes',
  'video',
  'sub1_video',
  'sub2_video',
] as const
export type ProgramColumn = (typeof PROGRAM_CSV_COLUMNS)[number]

/** Exercise field per CSV column (week / block / day place the row instead). */
const FIELD_OF: Partial<Record<ProgramColumn, keyof ProgramExercise>> = {
  exercise: 'n',
  technique: 't',
  warmup_sets: 'w',
  working_sets: 's',
  reps: 'r',
  early_rpe: 'e',
  last_rpe: 'l',
  rest: 'rest',
  sub1: 's1',
  sub2: 's2',
  notes: 'note',
  video: 'v',
  sub1_video: 'v1',
  sub2_video: 'v2',
}

/** Common alternative header spellings (after normalizeHeader). */
const ALIASES: Record<string, ProgramColumn> = {
  warm_up_sets: 'warmup_sets',
  warmups: 'warmup_sets',
  sets: 'working_sets',
  early_set_rpe: 'early_rpe',
  last_set_rpe: 'last_rpe',
  substitution_1: 'sub1',
  substitution_2: 'sub2',
  sub_1: 'sub1',
  sub_2: 'sub2',
  note: 'notes',
  sub_1_video: 'sub1_video',
  sub_2_video: 'sub2_video',
}

const REQUIRED_KEYS = ['t', 'w', 's', 'r', 'e', 'l', 'rest'] as const
const OPTIONAL_KEYS = ['s1', 's2', 'note', 'v', 'v1', 'v2'] as const
const MAX_DAYS_PER_WEEK = 7
const MAX_ERRORS = 20

export interface ParseProgramOptions {
  /** Program name; defaults to the name in a JSON file, else "Imported program". */
  name?: string
  /** Program id; defaults to a new id. Ids inside the file are ignored, so an import never overwrites a program. */
  id?: string
}

export type ParseProgramResult = { program: Program; warnings: string[] } | { errors: string[] }

interface Draft {
  weeks: ProgramWeek[]
  name?: string
  description?: string
  schedule?: unknown
  warnings: string[]
}

type Fail = { errors: string[] }
const fail = (errors: string[]): Fail => ({
  errors: errors.length > MAX_ERRORS ? [...errors.slice(0, MAX_ERRORS), `…and ${errors.length - MAX_ERRORS} more problems.`] : errors,
})
const weekList = (ns: number[]): string => `Week${ns.length > 1 ? 's' : ''} ${ns.join(', ')}`
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const str = (x: unknown): string => (typeof x === 'string' ? x.trim() : typeof x === 'number' && Number.isFinite(x) ? String(x) : '')

/* ------------------------------------------------------------------ schedule */

/** Weekly patterns (slot 0 = the program start day). 5 days is the BTS pattern: Upper, Lower, rest, Pull, Push, Legs, rest. */
const PATTERNS: Record<number, (number | null)[]> = {
  1: [0, null, null, null, null, null, null],
  2: [0, null, null, 1, null, null, null],
  3: [0, null, 1, null, 2, null, null],
  4: [0, 1, null, 2, 3, null, null],
  5: [0, 1, null, 2, 3, 4, null],
  6: [0, 1, 2, 3, 4, 5, null],
  7: [0, 1, 2, 3, 4, 5, 6],
}

/**
 * Default 7-slot schedule for n workouts a week: training days spread over the week with rest days in
 * between (Mon/Wed/Fri for 3, Mon/Tue/Thu/Fri for 4, the BTS pattern for 5). More than 7 is clamped to 7.
 */
export function defaultSchedule(daysPerWeek: number): (number | null)[] {
  const n = Math.min(MAX_DAYS_PER_WEEK, Math.floor(daysPerWeek))
  return n >= 1 ? [...PATTERNS[n]] : [null, null, null, null, null, null, null]
}

/** A usable schedule: 7 slots, each null or a distinct day index below `days`. */
function isValidSchedule(s: unknown, days: number): s is (number | null)[] {
  if (!Array.isArray(s) || s.length !== 7) return false
  const used = s.filter((x) => x !== null)
  return used.every((x) => Number.isInteger(x) && x >= 0 && x < days) && new Set(used).size === used.length
}

/* ------------------------------------------------------------------ normalising weeks */

/** Read a field from an exercise object by its compact key or its CSV column name. */
function exField(raw: Record<string, unknown>, key: keyof ProgramExercise): string {
  if (raw[key] != null) return str(raw[key])
  const col = (Object.keys(FIELD_OF) as ProgramColumn[]).find((c) => FIELD_OF[c] === key)
  if (col && raw[col] != null) return str(raw[col])
  if (key === 'n' && raw.name != null) return str(raw.name)
  return ''
}

/** Build an exercise with defaults: technique "N/A", other prescription fields "", empty optional fields left out. */
export function normalizeExercise(raw: Record<string, unknown>): ProgramExercise {
  const e: ProgramExercise = { n: exField(raw, 'n'), t: '', w: '', s: '', r: '', e: '', l: '', rest: '' }
  for (const k of REQUIRED_KEYS) e[k] = exField(raw, k)
  if (!e.t) e.t = 'N/A'
  for (const k of OPTIONAL_KEYS) {
    const v = exField(raw, k)
    if (v) e[k] = v
  }
  return e
}

const isIntroWeek = (w: Pick<ProgramWeek, 'days'>): boolean => w.days.every((d) => d.ex.every((e) => e.t === 'N/A'))

/** Validate and normalise one week from JSON; problems are appended to `errors`. */
function normalizeWeek(raw: unknown, weekNo: number, errors: string[], warnings: string[]): ProgramWeek | null {
  const where = `Week ${weekNo}`
  if (!isObject(raw)) {
    errors.push(`${where} is not an object with "days".`)
    return null
  }
  if (!Array.isArray(raw.days) || raw.days.length === 0) {
    errors.push(`${where} has no days.`)
    return null
  }
  if (raw.days.length > MAX_DAYS_PER_WEEK) errors.push(`${where} has ${raw.days.length} days; a week can have at most ${MAX_DAYS_PER_WEEK}.`)
  const days = raw.days.map((d: unknown, di: number) => {
    const dayObj = isObject(d) ? d : {}
    let name = str(dayObj.name)
    if (!name) {
      name = `Day ${di + 1}`
      warnings.push(`${where}, day ${di + 1} has no name; called it "${name}".`)
    }
    const dayWhere = `${where}, day ${di + 1} (${name})`
    if (!Array.isArray(dayObj.ex) || dayObj.ex.length === 0) {
      errors.push(`${dayWhere} has no exercises.`)
      return { name, ex: [] }
    }
    const ex = dayObj.ex.map((e: unknown, ei: number) => {
      const exercise = normalizeExercise(isObject(e) ? e : {})
      if (!exercise.n) errors.push(`${dayWhere}, exercise ${ei + 1} has no name.`)
      return exercise
    })
    return { name, ex }
  })
  const week = { block: str(raw.block), intro: false, days }
  week.intro = typeof raw.intro === 'boolean' ? raw.intro : isIntroWeek(week)
  return week
}

function weeksFromJSON(list: unknown[], meta: Record<string, unknown>): Draft | Fail {
  if (list.length === 0) return fail(['The program has no weeks.'])
  const errors: string[] = []
  const warnings: string[] = []
  const weeks = list.map((w, i) => normalizeWeek(w, i + 1, errors, warnings))
  if (errors.length) return fail(errors)
  return {
    weeks: weeks as ProgramWeek[],
    name: str(meta.name) || undefined,
    description: str(meta.description) || undefined,
    schedule: meta.schedule,
    warnings,
  }
}

/** The original logbook format: an object keyed "1".."N". */
function weeksFromKeyed(data: Record<string, unknown>): Draft | Fail {
  const nums = Object.keys(data).map(Number)
  const max = Math.max(...nums)
  const missing = Array.from({ length: max }, (_, i) => i + 1).filter((n) => !nums.includes(n))
  if (nums.some((n) => n < 1)) return fail(['Week numbers must start at 1.'])
  if (new Set(nums).size !== nums.length) return fail(['A week number appears twice (e.g. "1" and "01").'])
  if (missing.length) return fail([`${weekList(missing)} ${missing.length > 1 ? 'are' : 'is'} missing: weeks must run from 1 to ${max} without gaps.`])
  const byNum = new Map(Object.entries(data).map(([k, v]) => [Number(k), v]))
  return weeksFromJSON(Array.from({ length: max }, (_, i) => byNum.get(i + 1)), {})
}

function fromJSON(src: string): Draft | Fail {
  let data: unknown
  try {
    data = JSON.parse(src)
  } catch (e) {
    return fail([`The file is not valid JSON (${(e as Error).message}).`])
  }
  if (Array.isArray(data)) return weeksFromJSON(data, {})
  if (!isObject(data)) return fail(['Expected a JSON object with the program weeks.'])
  if (Array.isArray(data.weeks)) return weeksFromJSON(data.weeks, data)
  const keys = Object.keys(data)
  if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) return weeksFromKeyed(data)
  return fail(['Unrecognised JSON: expected { "weeks": [...] }, a program object, or weeks keyed "1", "2", ….'])
}

/* ------------------------------------------------------------------ CSV */

interface CsvDay {
  name: string
  ex: ProgramExercise[]
}

const REQUIRED_COLUMNS = ['week', 'day', 'exercise'] as const
/** Rows searched for the header, so a title row or two above the table is fine. */
const HEADER_SEARCH_ROWS = 10

function fromCSV(src: string): Draft | Fail {
  const rows = parseCSV(src)
  const first = (rows[0] ?? []).map(normalizeHeader)
  if (first.includes('set') && first.includes('program_exercise'))
    return fail(['This looks like a workout log export, not a program. Import it as workout history instead.'])
  const found = rows
    .slice(0, HEADER_SEARCH_ROWS)
    .findIndex((r) => REQUIRED_COLUMNS.every((c) => headerIndex(r, PROGRAM_CSV_COLUMNS, ALIASES)[c] != null))
  const headerRow = Math.max(0, found)
  const col = headerIndex(rows[headerRow] ?? [], PROGRAM_CSV_COLUMNS, ALIASES)
  const missing = REQUIRED_COLUMNS.filter((c) => col[c] == null)
  if (missing.length) {
    return fail([
      `Missing column${missing.length > 1 ? 's' : ''} ${missing.join(', ')} in the header row. Expected: ${PROGRAM_CSV_COLUMNS.join(',')}.`,
    ])
  }
  const errors: string[] = []
  const warnings: string[] = []
  const weeks = new Map<number, { block: string; days: CsvDay[] }>()
  const reappeared = new Set<string>()
  let prevDay: CsvDay | null = null
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i]
    if (isBlankRow(r)) continue
    const rowNo = i + 1
    const get = (c: ProgramColumn): string => {
      const idx = col[c]
      return idx == null ? '' : (r[idx] ?? '').trim()
    }
    const weekRaw = get('week')
    const wm = weekRaw.match(/^(?:week\s*)?(\d+)(?:[.,]0+)?$/i)
    const weekNo = wm ? Number(wm[1]) : 0
    const dayName = get('day')
    const exName = get('exercise')
    const rowErrors = [
      weekNo >= 1 ? '' : weekRaw ? `week "${weekRaw}" is not a whole number of 1 or more` : 'the week is empty',
      dayName ? '' : 'the day is empty',
      exName ? '' : 'the exercise name is empty',
    ].filter(Boolean)
    if (rowErrors.length) {
      errors.push(`Row ${rowNo}: ${rowErrors.join('; ')}.`)
      continue
    }
    const raw: Record<string, unknown> = {}
    for (const c of PROGRAM_CSV_COLUMNS) {
      const key = FIELD_OF[c]
      if (key) raw[key] = get(c)
    }
    const week = weeks.get(weekNo) ?? { block: '', days: [] }
    weeks.set(weekNo, week)
    const block = get('block')
    if (block && !week.block) week.block = block
    else if (block && block !== week.block) warnings.push(`Row ${rowNo}: block "${block}" differs from "${week.block}" earlier in week ${weekNo}; kept "${week.block}".`)
    let day = week.days.find((d) => d.name === dayName)
    if (!day) {
      day = { name: dayName, ex: [] }
      week.days.push(day)
    } else if (day !== prevDay && !reappeared.has(`${weekNo}:${dayName}`)) {
      reappeared.add(`${weekNo}:${dayName}`)
      warnings.push(
        `Row ${rowNo}: day "${dayName}" of week ${weekNo} appears again after other rows; its exercises were added to the first "${dayName}". Keep each day's rows together and give days of the same week different names.`,
      )
    }
    prevDay = day
    day.ex.push(normalizeExercise(raw))
  }
  if (errors.length) return fail(errors)
  if (weeks.size === 0) return fail(['The file has a header row but no exercise rows.'])
  const max = Math.max(...weeks.keys())
  const gaps = Array.from({ length: max }, (_, i) => i + 1).filter((n) => !weeks.has(n))
  if (gaps.length) return fail([`No rows for ${weekList(gaps).toLowerCase()}: weeks must run from 1 to ${max} without gaps.`])
  const out: ProgramWeek[] = []
  for (let n = 1; n <= max; n++) {
    const w = weeks.get(n)!
    if (w.days.length > MAX_DAYS_PER_WEEK) errors.push(`Week ${n} has ${w.days.length} days; a week can have at most ${MAX_DAYS_PER_WEEK}.`)
    const days = w.days.map((d) => ({ name: d.name, ex: d.ex }))
    out.push({ block: w.block, intro: isIntroWeek({ days }), days })
  }
  if (errors.length) return fail(errors)
  return { weeks: out, warnings }
}

/* ------------------------------------------------------------------ public API */

/** Parse a program from JSON or CSV text. Returns the program (plus non-fatal warnings) or specific errors. */
export function parseProgram(text: string, opts: ParseProgramOptions = {}): ParseProgramResult {
  const src = text.replace(/^﻿/, '').trim()
  if (!src) return fail(['The file is empty.'])
  const draft = src[0] === '{' || src[0] === '[' ? fromJSON(src) : fromCSV(src)
  if ('errors' in draft) return draft
  const warnings = [...draft.warnings]
  const days = Math.max(...draft.weeks.map((w) => w.days.length))
  let schedule = defaultSchedule(days)
  if (draft.schedule !== undefined) {
    if (isValidSchedule(draft.schedule, days)) schedule = [...draft.schedule]
    else warnings.push('The schedule in the file is not valid (7 slots of distinct day numbers or null); using the default.')
  }
  return {
    program: {
      id: opts.id?.trim() || `prog-${uuid()}`,
      name: opts.name?.trim() || draft.name || 'Imported program',
      description: draft.description ?? '',
      weeks: draft.weeks,
      schedule,
      builtIn: false,
      createdBy: null,
      updatedAt: Date.now(),
    },
    warnings,
  }
}

/** One CSV row per exercise with the PROGRAM_CSV_COLUMNS header; parseProgram reads it back. */
export function programToCSV(p: Pick<Program, 'weeks'>, opts: { delimiter?: Delimiter; bom?: boolean } = {}): string {
  const rows: string[][] = [[...PROGRAM_CSV_COLUMNS]]
  p.weeks.forEach((w, wi) =>
    w.days.forEach((d) =>
      d.ex.forEach((e) =>
        rows.push([
          String(wi + 1),
          w.block,
          d.name,
          e.n,
          e.t,
          e.w,
          e.s,
          e.r,
          e.e,
          e.l,
          e.rest,
          e.s1 ?? '',
          e.s2 ?? '',
          e.note ?? '',
          e.v ?? '',
          e.v1 ?? '',
          e.v2 ?? '',
        ]),
      ),
    ),
  )
  return toCSV(rows, opts)
}

/** Week 1 of the BTS program as CSV: a filled-in template for coaches writing their own program. */
export function programTemplateCSV(opts: { delimiter?: Delimiter; bom?: boolean } = {}): string {
  return programToCSV({ weeks: BTS_PROGRAM.weeks.slice(0, 1) }, opts)
}
