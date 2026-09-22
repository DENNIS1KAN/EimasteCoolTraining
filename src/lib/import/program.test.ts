import { describe, expect, it } from 'vitest'
import { BTS_PROGRAM } from '../../data/programs'
import type { Program, ProgramWeek } from '../../data/types'
import { parseCSV, toCSV } from './csv'
import { PROGRAM_CSV_COLUMNS, defaultSchedule, normalizeExercise, parseProgram, programTemplateCSV, programToCSV, type ParseProgramResult } from './program'
import { programWorkouts, scheduledDate, workoutOn } from '../stats/schedule'

const BTS = BTS_PROGRAM
const HEADER = PROGRAM_CSV_COLUMNS.join(',')

function ok(r: ParseProgramResult): { program: Program; warnings: string[] } {
  if ('errors' in r) throw new Error(`expected a program, got errors:\n${r.errors.join('\n')}`)
  return r
}
function errors(r: ParseProgramResult): string[] {
  if (!('errors' in r)) throw new Error('expected errors, got a program')
  return r.errors
}
/** BTS weeks in the original logbook shape: keyed "1".."12", no intro flag. */
const keyedBTS = () => Object.fromEntries(BTS.weeks.map((w, i) => [String(i + 1), { block: w.block, days: w.days }]))

describe('defaultSchedule', () => {
  it('is the BTS pattern for 5 days a week', () => {
    expect(defaultSchedule(5)).toEqual(BTS.schedule)
  })

  it('spreads other counts over the week, each day exactly once', () => {
    expect(defaultSchedule(3)).toEqual([0, null, 1, null, 2, null, null])
    expect(defaultSchedule(4)).toEqual([0, 1, null, 2, 3, null, null])
    for (let n = 1; n <= 7; n++) {
      const s = defaultSchedule(n)
      expect(s).toHaveLength(7)
      expect(s.filter((x) => x !== null)).toEqual(Array.from({ length: n }, (_, i) => i))
    }
  })

  it('handles 0 and more than 7', () => {
    expect(defaultSchedule(0)).toEqual([null, null, null, null, null, null, null])
    expect(defaultSchedule(9)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('returns a fresh array each time', () => {
    const a = defaultSchedule(5)
    a[0] = null
    expect(defaultSchedule(5)[0]).toBe(0)
  })
})

describe('normalizeExercise', () => {
  it('fills defaults and leaves empty optional fields out', () => {
    expect(normalizeExercise({ n: ' Squat ' })).toEqual({ n: 'Squat', t: 'N/A', w: '', s: '', r: '', e: '', l: '', rest: '' })
  })

  it('accepts CSV-style keys and numbers', () => {
    expect(normalizeExercise({ exercise: 'Row', working_sets: 3, reps: '8-10', sub1: 'Cable Row', notes: 'Squeeze', technique: '' })).toEqual({
      n: 'Row',
      t: 'N/A',
      w: '',
      s: '3',
      r: '8-10',
      e: '',
      l: '',
      rest: '',
      s1: 'Cable Row',
      note: 'Squeeze',
    })
  })
})

describe('programToCSV / programTemplateCSV', () => {
  it('writes one row per exercise under the documented header', () => {
    const rows = parseCSV(programToCSV(BTS))
    expect(rows[0]).toEqual([...PROGRAM_CSV_COLUMNS])
    expect(rows).toHaveLength(1 + BTS.weeks.reduce((n, w) => n + w.days.reduce((m, d) => m + d.ex.length, 0), 0))
    expect(rows[1].slice(0, 5)).toEqual(['1', 'Foundation Block', 'Upper (Strength Focus)', '45° Incline Barbell Press', 'N/A'])
  })

  it('round-trips BTS: CSV -> parse gives back the same weeks and schedule', () => {
    const { program, warnings } = ok(parseProgram(programToCSV(BTS), { name: BTS.name, id: BTS.id }))
    expect(warnings).toEqual([])
    expect(program.weeks).toEqual(BTS.weeks)
    expect(program.schedule).toEqual(BTS.schedule)
    expect(program).toMatchObject({ id: BTS.id, name: BTS.name, builtIn: false, createdBy: null })
  })

  it('round-trips with a BOM and ; delimiter (Excel in a Greek locale)', () => {
    const { program } = ok(parseProgram(programToCSV(BTS, { bom: true, delimiter: ';' })))
    expect(program.weeks).toEqual(BTS.weeks)
  })

  it('the template is week 1 of BTS and imports as a one-week intro program', () => {
    const csv = programTemplateCSV()
    expect(csv.split('\r\n')[0]).toBe(HEADER)
    const { program } = ok(parseProgram(csv))
    expect(program.weeks).toEqual([BTS.weeks[0]])
    expect(program.weeks[0].intro).toBe(true)
    expect(program.schedule).toEqual(BTS.schedule)
  })
})

describe('parseProgram: JSON', () => {
  it('reads the original logbook JSON keyed by week, deriving intro weeks from the techniques', () => {
    const { program } = ok(parseProgram(JSON.stringify(keyedBTS()), { name: 'BTS copy' }))
    expect(program.weeks).toEqual(BTS.weeks)
    expect(program.weeks.filter((w) => w.intro).length).toBe(2)
    expect(program.name).toBe('BTS copy')
    expect(program.schedule).toEqual(BTS.schedule)
  })

  it('sorts keyed weeks numerically', () => {
    const k = keyedBTS()
    const shuffled = Object.fromEntries(['10', '2', '1', '12', '3', '11', '4', '5', '6', '7', '8', '9'].map((n) => [n, k[n]]))
    expect(ok(parseProgram(JSON.stringify(shuffled))).program.weeks).toEqual(BTS.weeks)
  })

  it('rejects keyed weeks with gaps or duplicates', () => {
    const k = keyedBTS()
    delete k['3']
    delete k['7']
    expect(errors(parseProgram(JSON.stringify(k)))).toEqual(['Weeks 3, 7 are missing: weeks must run from 1 to 12 without gaps.'])
    expect(errors(parseProgram(JSON.stringify({ '1': k['1'], '01': k['1'] })))[0]).toMatch(/twice/)
    expect(errors(parseProgram(JSON.stringify({ '0': k['1'] })))[0]).toMatch(/start at 1/)
  })

  it('reads a full Program object but never reuses its id', () => {
    const { program, warnings } = ok(parseProgram(JSON.stringify(BTS)))
    expect(program.id).not.toBe(BTS.id)
    expect(program.id).toMatch(/^prog-/)
    expect(program).toMatchObject({ name: BTS.name, description: BTS.description, schedule: BTS.schedule, builtIn: false })
    expect(program.weeks).toEqual(BTS.weeks)
    expect(warnings).toEqual([])
  })

  it('keeps an explicit intro flag and a valid custom schedule from the file', () => {
    const custom = { name: 'Custom', schedule: [null, 0, null, 1, null, null, null], weeks: [{ block: 'A', intro: false, days: [{ name: 'X', ex: [{ n: 'Squat' }] }, { name: 'Y', ex: [{ n: 'Bench' }] }] }] }
    const { program } = ok(parseProgram(JSON.stringify(custom)))
    expect(program.weeks[0].intro).toBe(false)
    expect(program.schedule).toEqual([null, 0, null, 1, null, null, null])
  })

  it('replaces an invalid schedule with the default, with a warning', () => {
    for (const schedule of [[0, 1], [0, 0, null, null, null, null, null], [0, 5, null, null, null, null, null], 'daily']) {
      const { program, warnings } = ok(parseProgram(JSON.stringify({ schedule, weeks: [{ days: [{ name: 'A', ex: [{ n: 'Squat' }] }, { name: 'B', ex: [{ n: 'Bench' }] }] }] })))
      expect(program.schedule).toEqual(defaultSchedule(2))
      expect(warnings[0]).toMatch(/schedule/)
    }
  })

  it('accepts { weeks } and a bare array of weeks, coercing numbers to text', () => {
    const weeks = [{ block: 'Base', days: [{ name: 'Full', ex: [{ n: 'Squat', s: 3, r: 5 }] }] }]
    expect(ok(parseProgram(JSON.stringify({ weeks }))).program.weeks[0].days[0].ex[0]).toMatchObject({ n: 'Squat', s: '3', r: '5', t: 'N/A' })
    expect(ok(parseProgram(JSON.stringify(weeks))).program.weeks).toHaveLength(1)
  })

  it('names unnamed days with a warning', () => {
    const r = ok(parseProgram(JSON.stringify([{ days: [{ ex: [{ n: 'Squat' }] }] }])))
    expect(r.program.weeks[0].days[0].name).toBe('Day 1')
    expect(r.warnings).toEqual(['Week 1, day 1 has no name; called it "Day 1".'])
  })

  it('gives specific validation errors', () => {
    expect(errors(parseProgram('{"weeks": []}'))).toEqual(['The program has no weeks.'])
    expect(errors(parseProgram('[{"block":"A","days":[]}]'))).toEqual(['Week 1 has no days.'])
    expect(errors(parseProgram('[{"days":[{"name":"Upper","ex":[]}]}]'))).toEqual(['Week 1, day 1 (Upper) has no exercises.'])
    expect(errors(parseProgram('[{"days":[{"name":"Upper","ex":[{"n":"Bench"},{"t":"Failure"}]}]}]'))).toEqual(['Week 1, day 1 (Upper), exercise 2 has no name.'])
    expect(errors(parseProgram('[1]'))).toEqual(['Week 1 is not an object with "days".'])
    const eight = Array.from({ length: 8 }, (_, i) => ({ name: `D${i}`, ex: [{ n: 'Squat' }] }))
    expect(errors(parseProgram(JSON.stringify([{ days: eight }])))).toEqual(['Week 1 has 8 days; a week can have at most 7.'])
  })

  it('reports invalid or unrecognised JSON', () => {
    expect(errors(parseProgram('{"weeks": ['))[0]).toMatch(/^The file is not valid JSON/)
    expect(errors(parseProgram('{"foo": 1}'))[0]).toMatch(/^Unrecognised JSON/)
    expect(errors(parseProgram('"text"'))[0]).toMatch(/not valid JSON|Expected/)
  })

  it('reports an empty file', () => {
    expect(errors(parseProgram(''))).toEqual(['The file is empty.'])
    expect(errors(parseProgram(' \n﻿'))).toEqual(['The file is empty.'])
  })
})

describe('parseProgram: CSV', () => {
  const csv = (...rows: string[][]) => toCSV(rows)

  it('needs only week, day and exercise; everything else defaults', () => {
    const { program } = ok(parseProgram(csv(['Week', 'Day', 'Exercise'], ['1', 'Full Body', 'Squat'], ['1', 'Full Body', 'Bench'], ['1', 'Arms', 'Curl'])))
    expect(program.weeks).toEqual([
      {
        block: '',
        intro: true,
        days: [
          {
            name: 'Full Body',
            ex: [
              { n: 'Squat', t: 'N/A', w: '', s: '', r: '', e: '', l: '', rest: '' },
              { n: 'Bench', t: 'N/A', w: '', s: '', r: '', e: '', l: '', rest: '' },
            ],
          },
          { name: 'Arms', ex: [{ n: 'Curl', t: 'N/A', w: '', s: '', r: '', e: '', l: '', rest: '' }] },
        ],
      },
    ])
    expect(program.schedule).toEqual(defaultSchedule(2))
    expect(program.name).toBe('Imported program')
  })

  it('matches headers case-insensitively in any order, with aliases, ignoring extra columns', () => {
    const text = csv(
      ['EXERCISE', 'Comment', 'Day', 'Sets', 'Warm-up Sets', 'Week', 'Technique', 'Note'],
      ['Squat', 'ignored', 'Legs', '3', '2', '1', 'Failure', 'Deep'],
    )
    expect(ok(parseProgram(text)).program.weeks[0]).toEqual({
      block: '',
      intro: false,
      days: [{ name: 'Legs', ex: [{ n: 'Squat', t: 'Failure', w: '2', s: '3', r: '', e: '', l: '', rest: '', note: 'Deep' }] }],
    })
  })

  it("reads a Greek Excel export: BOM, ';' delimiter, CRLF, Greek text", () => {
    const text = '﻿week;block;day;exercise;notes\r\n1;Βάση;Πάνω;Πιέσεις πάγκου;"Αργά; ελεγχόμενα"\r\n'
    const { program } = ok(parseProgram(text))
    expect(program.weeks[0].block).toBe('Βάση')
    expect(program.weeks[0].days[0]).toEqual({ name: 'Πάνω', ex: [expect.objectContaining({ n: 'Πιέσεις πάγκου', note: 'Αργά; ελεγχόμενα' })] })
  })

  it('sorts weeks and keeps day and exercise order of first appearance', () => {
    const text = csv(['week', 'day', 'exercise'], ['2', 'B', 'b1'], ['1', 'A', 'a1'], ['2', 'A', 'a2'], ['1', 'A', 'a1b'], ['1', 'B', 'b0'])
    const { program } = ok(parseProgram(text))
    expect(program.weeks.map((w) => w.days.map((d) => `${d.name}:${d.ex.map((e) => e.n).join('+')}`))).toEqual([['A:a1+a1b', 'B:b0'], ['B:b1', 'A:a2']])
  })

  it('accepts "Week 2" and "2.0" as week numbers and skips blank rows', () => {
    const text = csv(['week', 'day', 'exercise'], ['Week 1', 'A', 'x'], ['', '', ''], [''], ['2.0', 'A', 'y'])
    expect(ok(parseProgram(text)).program.weeks).toHaveLength(2)
  })

  it('reports row errors with row numbers (header is row 1, blank rows counted)', () => {
    const text = csv(['week', 'day', 'exercise'], ['1', 'A', 'Squat'], [''], ['x', 'A', 'Bench'], ['1', '', 'Row'], ['0', 'A', ''], ['-1', 'A', 'Curl'])
    expect(errors(parseProgram(text))).toEqual([
      'Row 4: week "x" is not a whole number of 1 or more.',
      'Row 5: the day is empty.',
      'Row 6: week "0" is not a whole number of 1 or more; the exercise name is empty.',
      'Row 7: week "-1" is not a whole number of 1 or more.',
    ])
  })

  it('reports missing columns, a header without rows and week gaps', () => {
    expect(errors(parseProgram('week,exercise\n1,Squat'))).toEqual([`Missing column day in the header row. Expected: ${HEADER}.`])
    expect(errors(parseProgram('name,reps\nSquat,5'))[0]).toMatch(/^Missing columns week, day, exercise/)
    expect(errors(parseProgram(HEADER + '\r\n'))).toEqual(['The file has a header row but no exercise rows.'])
    expect(errors(parseProgram(csv(['week', 'day', 'exercise'], ['1', 'A', 'x'], ['4', 'A', 'y'])))).toEqual([
      'No rows for weeks 2, 3: weeks must run from 1 to 4 without gaps.',
    ])
  })

  it('rejects more than 7 days in a week', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ['1', `D${i}`, 'Squat'])
    expect(errors(parseProgram(csv(['week', 'day', 'exercise'], ...rows)))).toEqual(['Week 1 has 8 days; a week can have at most 7.'])
  })

  it('caps a long error list', () => {
    const rows = Array.from({ length: 30 }, () => ['x', 'A', 'Squat'])
    const errs = errors(parseProgram(csv(['week', 'day', 'exercise'], ...rows)))
    expect(errs).toHaveLength(21)
    expect(errs[20]).toBe('…and 10 more problems.')
  })

  it('warns when a day reappears after other days (and merges it) or a block changes within a week', () => {
    const text = csv(['week', 'block', 'day', 'exercise'], ['1', 'Base', 'A', 'a1'], ['1', 'Base', 'B', 'b1'], ['1', 'Peak', 'A', 'a2'], ['1', '', 'A', 'a3'])
    const { program, warnings } = ok(parseProgram(text))
    expect(program.weeks[0].days.map((d) => d.ex.length)).toEqual([3, 1])
    expect(program.weeks[0].block).toBe('Base')
    expect(warnings).toEqual([
      'Row 4: block "Peak" differs from "Base" earlier in week 1; kept "Base".',
      'Row 4: day "A" of week 1 appears again after other rows; its exercises were added to the first "A". Keep each day\'s rows together and give days of the same week different names.',
    ])
  })

  it('warns once per reappearing day, and not for blank rows inside a day', () => {
    const text = csv(['week', 'day', 'exercise'], ['1', 'A', 'a1'], [''], ['1', 'A', 'a2'], ['1', 'B', 'b1'], ['1', 'A', 'a3'], ['1', 'B', 'b2'], ['1', 'A', 'a4'])
    const { program, warnings } = ok(parseProgram(text))
    expect(program.weeks[0].days.map((d) => d.ex.map((e) => e.n))).toEqual([['a1', 'a2', 'a3', 'a4'], ['b1', 'b2']])
    expect(warnings.map((w) => w.slice(0, 20))).toEqual(['Row 6: day "A" of we', 'Row 7: day "B" of we'])
  })

  it('finds the header below title rows and keeps true row numbers', () => {
    const text = csv(['BTS program for Stelios'], [''], ['week', 'day', 'exercise'], ['1', 'A', 'Squat'], ['1', '', 'Bench'])
    expect(errors(parseProgram(text))).toEqual(['Row 5: the day is empty.'])
    expect(ok(parseProgram(csv(['My program', ''], ['week', 'day', 'exercise'], ['1', 'A', 'Squat']))).program.weeks).toHaveLength(1)
  })

  it('recognises a workout-log export given by mistake', () => {
    const text = 'week,block,workout,order,exercise,program_exercise,set,weight,unit,reps,done,finished_on,extra_set,machine\n'
    expect(errors(parseProgram(text))[0]).toMatch(/workout log export/)
  })

  it('uses the most days in any week for the default schedule, and the result works with the schedule engine', () => {
    const text = csv(['week', 'day', 'exercise'], ['1', 'A', 'x'], ['1', 'B', 'x'], ['2', 'A', 'x'], ['2', 'B', 'x'], ['2', 'C', 'x'])
    const { program } = ok(parseProgram(text))
    expect(program.schedule).toEqual(defaultSchedule(3))
    for (const r of programWorkouts(program)) expect(workoutOn(program, '2026-03-25', scheduledDate(program, '2026-03-25', r))).toEqual(r)
  })
})

describe('parseProgram options', () => {
  it('trims name and id and falls back when blank', () => {
    const text = 'week,day,exercise\n1,A,Squat\n'
    expect(ok(parseProgram(text, { name: '  My plan ', id: ' p1 ' })).program).toMatchObject({ name: 'My plan', id: 'p1' })
    const p = ok(parseProgram(text, { name: ' ', id: '' })).program
    expect(p.name).toBe('Imported program')
    expect(p.id).toMatch(/^prog-[0-9a-f-]{36}$/)
  })

  it('generates a different id per import', () => {
    const text = 'week,day,exercise\n1,A,Squat\n'
    expect(ok(parseProgram(text)).program.id).not.toBe(ok(parseProgram(text)).program.id)
  })
})

describe('BTS data sanity (what the importer relies on)', () => {
  it('intro weeks are exactly the weeks without techniques', () => {
    const allNA = (w: ProgramWeek) => w.days.every((d) => d.ex.every((e) => e.t === 'N/A'))
    expect(BTS.weeks.map((w) => w.intro)).toEqual(BTS.weeks.map(allNA))
  })
})
