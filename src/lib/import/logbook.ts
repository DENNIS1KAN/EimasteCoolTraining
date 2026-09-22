/**
 * Workout history in the CSV format of the owner's original logbook app, one row per set:
 *
 *   week,block,workout,order,exercise,program_exercise,set,weight,unit,reps,done,finished_on,extra_set,machine
 *
 * "workout" is the day's short name ("Upper"), "order" the 1-based exercise position in the day, "exercise" the
 * name actually performed (maybe a substitution), "program_exercise" the main name, "done" yes/no per set and
 * "finished_on" the finish date (YYYY-MM-DD, empty while unfinished). exportLogbookCSV writes the same format,
 * so history can round-trip between apps.
 */
import type { ExerciseLog, Program, ProgramDay, ProgramExercise, ProgramWeek, SetLog, Unit, WorkoutLog } from '../../data/types'
import { dayShortName, exerciseName, workingSets } from '../../data/programs'
import { logId } from '../ids'
import { fromISODate, isISODate, isoFromMs, type ISODate } from '../dates'
import { kgToUnit, parseNum, unitToKg } from '../units'
import { logTime } from '../stats/lifts'
import { headerIndex, isBlankRow, parseCSV, toCSV, type Delimiter } from './csv'

export const LOGBOOK_CSV_COLUMNS = [
  'week',
  'block',
  'workout',
  'order',
  'exercise',
  'program_exercise',
  'set',
  'weight',
  'unit',
  'reps',
  'done',
  'finished_on',
  'extra_set',
  'machine',
] as const
export type LogbookColumn = (typeof LOGBOOK_CSV_COLUMNS)[number]

export interface LogbookImportOptions {
  memberId: string
  program: Program
  /** Unit for rows that have none (default "kg"). */
  unit?: Unit
  /** updatedAt of the created logs (default: now). */
  now?: number
}

export interface LogbookImportResult {
  logs: WorkoutLog[]
  warnings: string[]
}

/** Sets per exercise beyond which a set number is treated as a typo. */
const MAX_SETS = 30
const EMPTY_SET: SetLog = { w: '', r: '', ok: false }

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')

/* ------------------------------------------------------------------ cell parsers */

const YES = new Set(['yes', 'y', 'true', '1', 'x', '✓', '✔', 'done', 'ναι', 'ν'])
const NO = new Set(['no', 'n', 'false', '0', '', 'όχι', 'οχι'])

/** yes/no cell -> boolean, null when unrecognised. */
export function parseYesNo(s: string): boolean | null {
  const v = norm(s)
  return YES.has(v) ? true : NO.has(v) ? false : null
}

/** "kg" / "lb" (also "kgs", "lbs", "pounds") -> unit; null when empty; undefined when unrecognised. */
function parseUnit(s: string): Unit | null | undefined {
  const v = norm(s)
  if (!v) return null
  if (['kg', 'kgs', 'kilo', 'kilos', 'κιλά', 'κιλα'].includes(v)) return 'kg'
  if (['lb', 'lbs', 'pound', 'pounds'].includes(v)) return 'lb'
  return undefined
}

/**
 * Finish date -> ISO date; null when empty; undefined when invalid. Besides YYYY-MM-DD it accepts the
 * day-first D/M/YYYY (also with '.' or '-') that Excel in a Greek locale writes back when the file is re-saved.
 */
export function parseFinishDate(s: string): ISODate | null | undefined {
  const v = s.trim()
  if (!v) return null
  const iso = v.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(v) && isISODate(iso)) return iso
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) {
    const d = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    if (isISODate(d)) return d
  }
  return undefined
}

const positiveInt = (s: string): number | null => {
  const m = s.trim().match(/^(\d+)(?:[.,]0+)?$/)
  const n = m ? Number(m[1]) : 0
  return n >= 1 ? n : null
}

/* ------------------------------------------------------------------ program lookups */

/** Day index for a "workout" cell: full name, else short name, else a 1-based number. */
function resolveDay(week: ProgramWeek, workout: string): { day: number; ambiguous: boolean } | null {
  const w = norm(workout)
  if (!w) return null
  const full = week.days.findIndex((d) => norm(d.name) === w)
  if (full >= 0) return { day: full, ambiguous: false }
  const short = week.days.map((d, i) => (norm(dayShortName(d)) === w ? i : -1)).filter((i) => i >= 0)
  if (short.length) return { day: short[0], ambiguous: short.length > 1 }
  const n = positiveInt(workout)
  return n != null && n <= week.days.length ? { day: n - 1, ambiguous: false } : null
}

/** Variant performed: 0 main, 1/2 substitutions; null when the name matches none of them. */
function resolveVariant(e: ProgramExercise, performed: string): 0 | 1 | 2 | null {
  const p = norm(performed)
  if (!p || p === norm(e.n)) return 0
  if (e.s1 && p === norm(e.s1)) return 1
  if (e.s2 && p === norm(e.s2)) return 2
  return null
}

const matchesExercise = (e: ProgramExercise, name: string): boolean => resolveVariant(e, name) !== null && !!norm(name)

/**
 * Exercise index for a row. The program_exercise name wins when it identifies another position (the
 * program may have been reordered); otherwise "order" is used, then the names.
 */
function resolveExercise(day: ProgramDay, order: number | null, programName: string, performed: string): { index: number; note?: string } | null {
  const byOrder = order != null && order <= day.ex.length ? order - 1 : -1
  const pn = norm(programName)
  if (pn) {
    if (byOrder >= 0 && norm(day.ex[byOrder].n) === pn) return { index: byOrder }
    const byName = day.ex.findIndex((e) => norm(e.n) === pn)
    if (byName >= 0) return { index: byName, note: byOrder >= 0 ? `found "${programName}" at position ${byName + 1}, not ${order}` : undefined }
  }
  if (byOrder >= 0) {
    return pn ? { index: byOrder, note: `"${programName}" is not in this workout; used position ${order} (${day.ex[byOrder].n})` } : { index: byOrder }
  }
  const byPerformed = day.ex.findIndex((e) => matchesExercise(e, performed))
  return byPerformed >= 0 ? { index: byPerformed } : null
}

/** Weight typed in `from`, rewritten in `to` (2 decimals); left as typed when it isn't a number. */
function convertWeight(w: string, from: Unit, to: Unit): string {
  const n = parseNum(w)
  if (n == null || from === to) return w
  return String(Math.round(kgToUnit(unitToKg(n, from), to) * 100) / 100)
}

/* ------------------------------------------------------------------ import */

interface SetRow {
  set: SetLog
  unit: Unit
  row: number
}
interface ExGroup {
  v: 0 | 1 | 2
  performed: string
  m: string
  sets: Map<number, SetRow>
}
interface Group {
  week: number
  day: number
  finished: Set<ISODate>
  ex: Map<number, ExGroup>
}

/** Import a logbook CSV for one member and program. Rows that cannot be placed are skipped with a warning. */
export function importLogbookCSV(text: string, opts: LogbookImportOptions): LogbookImportResult {
  const { program } = opts
  const defaultUnit: Unit = opts.unit ?? 'kg'
  const warnings: string[] = []
  const warnOnce = new Set<string>()
  const warn = (msg: string, key?: string) => {
    if (key && warnOnce.has(key)) return
    if (key) warnOnce.add(key)
    warnings.push(msg)
  }
  const rows = parseCSV(text)
  if (rows.length === 0 || rows.every(isBlankRow)) return { logs: [], warnings: ['The file is empty.'] }
  const col = headerIndex(rows[0], LOGBOOK_CSV_COLUMNS)
  const missing: string[] = (['week', 'workout', 'set', 'weight', 'reps'] as const).filter((c) => col[c] == null)
  if (col.order == null && col.program_exercise == null && col.exercise == null) missing.push('order')
  if (missing.length) {
    return { logs: [], warnings: [`Missing column${missing.length > 1 ? 's' : ''} ${missing.join(', ')}. Expected: ${LOGBOOK_CSV_COLUMNS.join(',')}.`] }
  }

  const groups = new Map<string, Group>()
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (isBlankRow(r)) continue
    const rowNo = i + 1
    const get = (c: LogbookColumn): string => {
      const idx = col[c]
      return idx == null ? '' : (r[idx] ?? '').trim()
    }
    const week = positiveInt(get('week'))
    if (week == null || week > program.weeks.length) {
      warn(`Row ${rowNo}: week "${get('week')}" is not a week of ${program.name} (1-${program.weeks.length}); skipped.`)
      continue
    }
    const pw = program.weeks[week - 1]
    const dayRes = resolveDay(pw, get('workout'))
    if (!dayRes) {
      warn(`Row ${rowNo}: workout "${get('workout')}" is not a day of week ${week} (${pw.days.map(dayShortName).join(', ')}); skipped.`)
      continue
    }
    if (dayRes.ambiguous) warn(`Several days of week ${week} are called "${get('workout')}"; rows were matched to the first.`, `amb:${week}:${norm(get('workout'))}`)
    const key = `${week}:${dayRes.day}`
    const g: Group = groups.get(key) ?? { week, day: dayRes.day, finished: new Set(), ex: new Map() }
    groups.set(key, g)

    const fin = parseFinishDate(get('finished_on'))
    if (fin === undefined) warn(`Row ${rowNo}: finished_on "${get('finished_on')}" is not a date (YYYY-MM-DD); ignored.`)
    else if (fin) g.finished.add(fin)

    // A row without exercise or set only marks the workout (e.g. finished with nothing logged).
    if (!get('order') && !get('exercise') && !get('program_exercise') && !get('set')) continue

    const day = pw.days[dayRes.day]
    const exRes = resolveExercise(day, positiveInt(get('order')), get('program_exercise'), get('exercise'))
    if (!exRes) {
      const name = get('program_exercise') || get('exercise')
      const what = [get('order') && `#${get('order')}`, name && `"${name}"`].filter(Boolean).join(' ')
      warn(`Row ${rowNo}: cannot find exercise ${what} in ${day.name} (week ${week}); skipped.`)
      continue
    }
    if (exRes.note) warn(`Row ${rowNo}: ${exRes.note}.`, `ex:${key}:${exRes.index}:${exRes.note}`)
    const e = day.ex[exRes.index]
    const setNo = positiveInt(get('set'))
    if (setNo == null || setNo > MAX_SETS) {
      warn(`Row ${rowNo}: set "${get('set')}" is not a set number between 1 and ${MAX_SETS}; skipped.`)
      continue
    }
    let unit = parseUnit(get('unit'))
    if (unit === undefined) {
      warn(`Row ${rowNo}: unknown unit "${get('unit')}"; assumed ${defaultUnit}.`, `unit:${norm(get('unit'))}`)
      unit = defaultUnit
    }
    let ok = parseYesNo(get('done'))
    if (ok === null) {
      warn(`Row ${rowNo}: done "${get('done')}" is not yes/no; treated as no.`)
      ok = false
    }

    const performed = get('exercise')
    let x = g.ex.get(exRes.index)
    if (!x) {
      const v = resolveVariant(e, performed)
      if (v === null) warn(`Row ${rowNo}: "${performed}" is not ${e.n} or one of its substitutions; logged as ${e.n}.`, `var:${key}:${exRes.index}`)
      x = { v: v ?? 0, performed, m: '', sets: new Map() }
      g.ex.set(exRes.index, x)
    } else if (norm(performed) && norm(performed) !== norm(x.performed)) {
      warn(`Row ${rowNo}: "${performed}" differs from "${x.performed}" logged earlier for ${e.n} in week ${week}; kept "${x.performed}".`, `mix:${key}:${exRes.index}`)
    }
    if (!x.m) x.m = get('machine')
    const prev = x.sets.get(setNo)
    if (prev) warn(`Row ${rowNo}: set ${setNo} of ${e.n} (week ${week}, ${dayShortName(day)}) repeats row ${prev.row}; the later row wins.`)
    x.sets.set(setNo, { set: { w: get('weight'), r: get('reps'), ok }, unit: unit ?? defaultUnit, row: rowNo })
  }

  const now = opts.now ?? Date.now()
  const logs = [...groups.values()]
    .sort((a, b) => a.week - b.week || a.day - b.day)
    .map((g) => buildLog(g, opts, defaultUnit, now, warn))
    .filter((l): l is WorkoutLog => l !== null)
  return { logs, warnings }
}

/** Most frequent unit among the set rows (first seen wins ties). */
function majorityUnit(g: Group, fallback: Unit): Unit {
  const count = new Map<Unit, number>()
  for (const x of g.ex.values()) for (const s of x.sets.values()) count.set(s.unit, (count.get(s.unit) ?? 0) + 1)
  let best: Unit = fallback
  let n = 0
  for (const [u, c] of count) if (c > n) [best, n] = [u, c]
  return best
}

function buildLog(g: Group, opts: LogbookImportOptions, defaultUnit: Unit, now: number, warn: (m: string, k?: string) => void): WorkoutLog | null {
  const unit = majorityUnit(g, defaultUnit)
  const label = `Week ${g.week}, ${dayShortName(opts.program.weeks[g.week - 1].days[g.day])}`
  const ex: Record<string, ExerciseLog> = {}
  let converted = false
  let content = false
  for (const [index, x] of [...g.ex.entries()].sort((a, b) => a[0] - b[0])) {
    const sets = Array.from({ length: Math.max(...x.sets.keys()) }, (_, i) => {
      const s = x.sets.get(i + 1)
      if (!s) return { ...EMPTY_SET }
      if (s.unit !== unit) converted = true
      return { ...s.set, w: convertWeight(s.set.w, s.unit, unit) }
    })
    if (x.m || sets.some((s) => s.w || s.r || s.ok)) content = true
    ex[String(index)] = { v: x.v, m: x.m, sets }
  }
  if (converted) warn(`${label} mixes kg and lb; weights were converted to ${unit}.`)
  const dates = [...g.finished].sort()
  if (dates.length > 1) warn(`${label} has several finish dates (${dates.join(', ')}); used ${dates[dates.length - 1]}.`)
  const finishedOn = dates[dates.length - 1]
  if (!content && !finishedOn) return null // nothing trained yet: no log
  return {
    id: logId(opts.memberId, opts.program.id, g.week, g.day),
    memberId: opts.memberId,
    programId: opts.program.id,
    week: g.week,
    day: g.day,
    unit,
    ex,
    done: !!finishedOn,
    doneAt: finishedOn ? fromISODate(finishedOn).getTime() : null,
    startedAt: null,
    feel: null,
    note: '',
    updatedAt: now,
  }
}

/* ------------------------------------------------------------------ export */

/** The day's short name, or its full name when another day of the week shares the short name. */
function workoutLabel(week: ProgramWeek, day: number): string {
  const short = dayShortName(week.days[day])
  return week.days.filter((d) => dayShortName(d) === short).length > 1 ? week.days[day].name : short
}

/**
 * Export logs in the logbook format (one row per set, logs ordered by program, week and day). Logs whose
 * program, week or day is unknown are left out. A finished log without sets gets one row without exercise,
 * so the finish survives a round trip.
 */
export function exportLogbookCSV(
  logs: readonly WorkoutLog[],
  programs: readonly Program[] | Readonly<Record<string, Program>>,
  opts: { delimiter?: Delimiter; bom?: boolean } = {},
): string {
  const byId: Record<string, Program> = Array.isArray(programs)
    ? Object.fromEntries((programs as readonly Program[]).map((p) => [p.id, p]))
    : (programs as Record<string, Program>)
  const rows: (string | number)[][] = [[...LOGBOOK_CSV_COLUMNS]]
  const sorted = [...logs].sort((a, b) => (a.programId < b.programId ? -1 : a.programId > b.programId ? 1 : a.week - b.week || a.day - b.day))
  for (const l of sorted) {
    const pw = byId[l.programId]?.weeks[l.week - 1]
    const day = pw?.days[l.day]
    if (!pw || !day) continue
    const workout = workoutLabel(pw, l.day)
    const finished = l.done ? isoFromMs(logTime(l)) : ''
    const start = rows.length
    const indices = Object.keys(l.ex)
      .map(Number)
      .filter((i) => Number.isInteger(i) && day.ex[i])
      .sort((a, b) => a - b)
    for (const i of indices) {
      const e = day.ex[i]
      const x = l.ex[String(i)]
      x.sets.forEach((s, j) =>
        rows.push([l.week, pw.block, workout, i + 1, exerciseName(e, x.v), e.n, j + 1, s.w, l.unit, s.r, s.ok ? 'yes' : 'no', finished, j >= workingSets(e) ? 'yes' : 'no', x.m]),
      )
    }
    if (rows.length === start && l.done) rows.push([l.week, pw.block, workout, '', '', '', '', '', l.unit, '', '', finished, '', ''])
  }
  return toCSV(rows, opts)
}
