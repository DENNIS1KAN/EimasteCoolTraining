import { describe, expect, it } from 'vitest'
import { DST_AUTUMN, MINI, at, mkLog } from '../testing/fixtures'
import { BTS_PROGRAM } from '../../data/programs'
import type { Program, WorkoutLog } from '../../data/types'
import { fromISODate } from '../dates'
import { logDate, performedExercises, personalRecords } from '../stats/lifts'
import { parseCSV } from './csv'
import { LOGBOOK_CSV_COLUMNS, exportLogbookCSV, importLogbookCSV, parseFinishDate, parseYesNo } from './logbook'

const BTS = BTS_PROGRAM
const NOW = at('2026-09-22', 12)
const HEADER = LOGBOOK_CSV_COLUMNS.join(',')
const opts = { memberId: 'stelios', program: BTS, now: NOW }
const csv = (...lines: string[]) => [HEADER, ...lines].map((l) => l + '\r\n').join('')
const noon = (d: string) => fromISODate(d).getTime()

/** What the original app exports: a substitution, a decimal comma, an extra set, a machine, an unfinished day, a pound log. */
const SAMPLE = csv(
  '1,Foundation Block,Upper,1,45° Incline DB Press,45° Incline Barbell Press,1,30,kg,8,yes,2026-03-23,no,',
  '1,Foundation Block,Upper,1,45° Incline DB Press,45° Incline Barbell Press,2,"32,5",kg,7,yes,2026-03-23,no,',
  '1,Foundation Block,Upper,1,45° Incline DB Press,45° Incline Barbell Press,3,30,kg,6,yes,2026-03-23,yes,',
  '1,Foundation Block,Upper,2,Cable Crossover Ladder,Cable Crossover Ladder,1,15,kg,10,yes,2026-03-23,no,Life Fitness',
  '1,Foundation Block,Upper,2,Cable Crossover Ladder,Cable Crossover Ladder,2,15,kg,9,no,2026-03-23,no,Life Fitness',
  '1,Foundation Block,Lower,2,Smith Machine Squat,Smith Machine Squat,1,60,kg,8,yes,,no,',
  '1,Foundation Block,Lower,2,Smith Machine Squat,Smith Machine Squat,2,,kg,,no,,no,',
  '2,Foundation Block,Upper,1,45° Incline Barbell Press,45° Incline Barbell Press,1,135,lb,8,yes,2026-03-30,no,',
)

function sampleLogs(): WorkoutLog[] {
  const { logs, warnings } = importLogbookCSV(SAMPLE, opts)
  expect(warnings).toEqual([])
  return logs
}

describe('importLogbookCSV', () => {
  it('builds one log per (week, day) with ids, variants, machines, sets, finish and unit', () => {
    const logs = sampleLogs()
    expect(logs.map((l) => l.id)).toEqual(['stelios__bts-12__w1d0', 'stelios__bts-12__w1d1', 'stelios__bts-12__w2d0'])
    expect(logs[0]).toEqual({
      id: 'stelios__bts-12__w1d0',
      memberId: 'stelios',
      programId: 'bts-12',
      week: 1,
      day: 0,
      unit: 'kg',
      ex: {
        '0': {
          v: 1,
          m: '',
          sets: [
            { w: '30', r: '8', ok: true },
            { w: '32,5', r: '7', ok: true },
            { w: '30', r: '6', ok: true },
          ],
        },
        '1': {
          v: 0,
          m: 'Life Fitness',
          sets: [
            { w: '15', r: '10', ok: true },
            { w: '15', r: '9', ok: false },
          ],
        },
      },
      done: true,
      doneAt: noon('2026-03-23'),
      startedAt: null,
      feel: null,
      note: '',
      updatedAt: NOW,
    })
  })

  it('an unfinished workout is imported as started, not done', () => {
    const lower = sampleLogs()[1]
    expect(lower).toMatchObject({ day: 1, done: false, doneAt: null })
    expect(lower.ex['1'].sets).toEqual([
      { w: '60', r: '8', ok: true },
      { w: '', r: '', ok: false },
    ])
  })

  it('keeps pound logs in pounds', () => {
    expect(sampleLogs()[2]).toMatchObject({ unit: 'lb', week: 2, day: 0, doneAt: noon('2026-03-30') })
  })

  it('works with the stats engine: substitutions keep their own identity, pounds are converted', () => {
    const logs = sampleLogs()
    expect(performedExercises(logs[0], BTS)[0].name).toBe('45° Incline DB Press')
    expect(performedExercises(logs[0], BTS)[0].sets[1].kg).toBe(32.5)
    expect(performedExercises(logs[2], BTS)[0].sets[0].kg).toBeCloseTo(61.235, 3)
    expect(logDate(logs[0])).toBe('2026-03-23')
    expect(personalRecords(logs, { [BTS.id]: BTS })).toEqual([]) // DB press and barbell press are different lifts
  })

  it('finished_on is local noon of that date, also on a DST day', () => {
    const { logs } = importLogbookCSV(csv(`1,,Upper,1,,45° Incline Barbell Press,1,60,kg,5,yes,${DST_AUTUMN},no,`), opts)
    expect(logs[0].doneAt).toBe(noon(DST_AUTUMN))
    expect(new Date(logs[0].doneAt!).getHours()).toBe(12)
    expect(logDate(logs[0])).toBe(DST_AUTUMN)
  })

  it('matches workouts by short name, full name, any case, or number', () => {
    for (const w of ['Upper', 'upper', 'Upper (Strength Focus)', '1', ' UPPER ']) {
      const { logs, warnings } = importLogbookCSV(csv(`1,,${w},1,,,1,60,kg,5,yes,,no,`), opts)
      expect(warnings).toEqual([])
      expect(logs[0].day).toBe(0)
    }
    const r = importLogbookCSV(csv('1,,Chest,1,,,1,60,kg,5,yes,,no,'), opts)
    expect(r.logs).toEqual([])
    expect(r.warnings).toEqual(['Row 2: workout "Chest" is not a day of week 1 (Upper, Lower, Pull, Push, Legs); skipped.'])
  })

  it('skips weeks outside the program with a warning', () => {
    const r = importLogbookCSV(csv('13,,Upper,1,,,1,60,kg,5,yes,,no,', 'x,,Upper,1,,,1,60,kg,5,yes,,no,'), opts)
    expect(r.logs).toEqual([])
    expect(r.warnings).toEqual([
      'Row 2: week "13" is not a week of BTS · 12 weeks (1-12); skipped.',
      'Row 3: week "x" is not a week of BTS · 12 weeks (1-12); skipped.',
    ])
  })

  it('resolves the variant from the performed name, falling back to the main exercise with a warning', () => {
    const r = importLogbookCSV(
      csv(
        '1,,Upper,3,Dual-Handle Lat Pulldown,Wide-Grip Pull-Up,1,50,kg,10,yes,,no,',
        '1,,Upper,4,Cable Y-Raise,High-Cable Lateral Raise,1,5,kg,12,yes,,no,',
        '1,,Upper,5,pendlay deficit row,Pendlay Deficit Row,1,60,kg,8,yes,,no,',
      ),
      opts,
    )
    expect(r.logs[0].ex['2'].v).toBe(2)
    expect(r.logs[0].ex['3'].v).toBe(0)
    expect(r.logs[0].ex['4'].v).toBe(0)
    expect(r.warnings).toEqual(['Row 3: "Cable Y-Raise" is not High-Cable Lateral Raise or one of its substitutions; logged as High-Cable Lateral Raise.'])
  })

  it('finds the exercise by name when order is missing or disagrees with program_exercise', () => {
    const r = importLogbookCSV(
      csv(
        '1,,Upper,,Pec Deck,,1,40,kg,10,yes,,no,', // no order, no program name: found by the substitution name
        '1,,Upper,,,Bayesian Cable Curl,1,10,kg,10,yes,,no,', // no order: found by program name
        '1,,Upper,1,,Pendlay Deficit Row,1,60,kg,8,yes,,no,', // name wins over a stale order
        '1,,Upper,6,,Some Old Exercise,1,20,kg,12,yes,,no,', // unknown name: order is used
        '1,,Upper,,Mystery,,1,20,kg,12,yes,,no,', // nothing matches
        '1,,Upper,9,,,1,20,kg,12,yes,,no,', // no such position
      ),
      opts,
    )
    const ex = r.logs[0].ex
    expect(Object.keys(ex).sort()).toEqual(['1', '4', '5', '6'])
    expect(ex['1'].v).toBe(1)
    expect(r.warnings).toEqual([
      'Row 4: found "Pendlay Deficit Row" at position 5, not 1.',
      'Row 5: "Some Old Exercise" is not in this workout; used position 6 (Overhead Cable Triceps Extension (Bar)).',
      'Row 6: cannot find exercise "Mystery" in Upper (Strength Focus) (week 1); skipped.',
      'Row 7: cannot find exercise #9 in Upper (Strength Focus) (week 1); skipped.',
    ])
  })

  it('orders sets by number, fills gaps, allows extra sets, and warns about duplicates', () => {
    const r = importLogbookCSV(
      csv(
        '1,,Upper,1,,,4,70,kg,4,yes,,yes,',
        '1,,Upper,1,,,1,60,kg,8,yes,,no,',
        '1,,Upper,1,,,1,62.5,kg,8,yes,,no,',
        '1,,Upper,1,,,99,1,kg,1,yes,,no,',
        '1,,Upper,1,,,0,1,kg,1,yes,,no,',
      ),
      opts,
    )
    expect(r.logs[0].ex['0'].sets).toEqual([
      { w: '62.5', r: '8', ok: true },
      { w: '', r: '', ok: false },
      { w: '', r: '', ok: false },
      { w: '70', r: '4', ok: true },
    ])
    expect(r.warnings).toEqual([
      'Row 4: set 1 of 45° Incline Barbell Press (week 1, Upper) repeats row 3; the later row wins.',
      'Row 5: set "99" is not a set number between 1 and 30; skipped.',
      'Row 6: set "0" is not a set number between 1 and 30; skipped.',
    ])
  })

  it('converts a minority unit to the log unit', () => {
    const r = importLogbookCSV(csv('1,,Upper,1,,,1,100,kg,5,yes,,no,', '1,,Upper,1,,,2,100,kg,5,yes,,no,', '1,,Upper,1,,,3,225,lb,5,yes,,no,'), opts)
    expect(r.logs[0].unit).toBe('kg')
    expect(r.logs[0].ex['0'].sets[2].w).toBe('102.06')
    expect(r.warnings).toEqual(['Week 1, Upper mixes kg and lb; weights were converted to kg.'])
  })

  it('uses opts.unit when the unit is missing, and warns about unknown units', () => {
    const noUnit = importLogbookCSV(csv('1,,Upper,1,,,1,135,,5,yes,,no,'), { ...opts, unit: 'lb' })
    expect(noUnit.logs[0].unit).toBe('lb')
    const bad = importLogbookCSV(csv('1,,Upper,1,,,1,60,stone,5,yes,,no,', '1,,Upper,1,,,2,60,stone,5,yes,,no,'), opts)
    expect(bad.logs[0].unit).toBe('kg')
    expect(bad.warnings).toEqual(['Row 2: unknown unit "stone"; used the workout\'s unit.'])
  })

  it('sets without a unit take the workout unit instead of being converted from the default', () => {
    const r = importLogbookCSV(csv('1,,Upper,1,,,1,135,lb,5,yes,,no,', '1,,Upper,1,,,2,135,,5,yes,,no,', '1,,Upper,1,,,3,140,lbs,5,yes,,no,'), opts)
    expect(r.logs[0].unit).toBe('lb')
    expect(r.logs[0].ex['0'].sets.map((s) => s.w)).toEqual(['135', '135', '140'])
    expect(r.warnings).toEqual([])
  })

  it('takes the variant from the first row that names the performed exercise, and warns on a mix', () => {
    const r = importLogbookCSV(
      csv(
        '1,,Upper,1,,45° Incline Barbell Press,1,30,kg,8,yes,,no,',
        '1,,Upper,1,45° Incline Machine Press,45° Incline Barbell Press,2,30,kg,8,yes,,no,',
        '1,,Upper,1,45° Incline DB Press,45° Incline Barbell Press,3,30,kg,8,yes,,no,',
      ),
      opts,
    )
    expect(r.logs[0].ex['0'].v).toBe(2)
    expect(r.warnings).toEqual([
      'Row 4: "45° Incline DB Press" differs from "45° Incline Machine Press" logged earlier for 45° Incline Barbell Press in week 1; kept "45° Incline Machine Press".',
    ])
  })

  it('reads done flags leniently and warns on nonsense', () => {
    const cells = ['Yes', 'TRUE', '1', 'ναι', 'x', 'no', '', 'maybe']
    const r = importLogbookCSV(csv(...cells.map((d, i) => `1,,Upper,1,,,${i + 1},60,kg,5,${d},,no,`)), opts)
    expect(r.logs[0].ex['0'].sets.map((s) => s.ok)).toEqual([true, true, true, true, true, false, false, false])
    expect(r.warnings).toEqual(['Row 9: done "maybe" is not yes/no; treated as no.'])
  })

  it('finish dates: day-first dates from Excel, invalid dates, several dates in one workout', () => {
    const r = importLogbookCSV(
      csv(
        '1,,Upper,1,,,1,60,kg,5,yes,23/3/2026,no,',
        '1,,Lower,1,,,1,60,kg,5,yes,2026-02-30,no,',
        '1,,Pull,1,,,1,60,kg,5,yes,2026-03-26,no,',
        '1,,Pull,1,,,2,60,kg,5,yes,2026-03-27,no,',
      ),
      opts,
    )
    expect(r.logs.map((l) => [l.day, l.done, l.doneAt])).toEqual([
      [0, true, noon('2026-03-23')],
      [1, false, null],
      [2, true, noon('2026-03-27')],
    ])
    expect(r.warnings).toEqual([
      'Row 3: finished_on "2026-02-30" is not a date (YYYY-MM-DD); ignored.',
      'Week 1, Pull has several finish dates (2026-03-26, 2026-03-27); used 2026-03-27.',
    ])
  })

  it('does not create logs for workouts with nothing in them', () => {
    const r = importLogbookCSV(csv('1,,Upper,1,,,1,,kg,,no,,no,', '1,,Upper,1,,,2,,kg,,no,,no,', '1,,Lower,1,,,1,,kg,,no,,no,Hammer'), opts)
    expect(r.logs.map((l) => l.day)).toEqual([1]) // the machine alone is worth keeping
    expect(r.warnings).toEqual([])
  })

  it("reads a ';'-separated file with a BOM and CRLF, with columns in any order", () => {
    const text = '﻿set;reps;weight;workout;week;order;done;finished_on\r\n1;8;57,5;Upper;1;1;ναι;2026-03-23\r\n'
    const r = importLogbookCSV(text, opts)
    expect(r.warnings).toEqual([])
    expect(r.logs[0]).toMatchObject({ done: true, ex: { '0': { v: 0, m: '', sets: [{ w: '57,5', r: '8', ok: true }] } } })
  })

  it('reports missing columns and empty files', () => {
    expect(importLogbookCSV('', opts)).toEqual({ logs: [], warnings: ['The file is empty.'] })
    expect(importLogbookCSV('\r\n\r\n', opts)).toEqual({ logs: [], warnings: ['The file is empty.'] })
    expect(importLogbookCSV('week,workout,set\n1,Upper,1', opts).warnings).toEqual([`Missing columns weight, reps, order. Expected: ${HEADER}.`])
  })

  it('skips blank lines without shifting row numbers', () => {
    const r = importLogbookCSV(`${HEADER}\r\n\r\n,,,,,,,,,,,,,\r\n1,,Chest,1,,,1,60,kg,5,yes,,no,\r\n`, opts)
    expect(r.warnings[0]).toMatch(/^Row 4:/)
  })
})

describe('exportLogbookCSV', () => {
  it('writes the original app format exactly (round trip of an export)', () => {
    expect(exportLogbookCSV(sampleLogs(), [BTS])).toBe(SAMPLE)
  })

  it('import(export(logs)) gives the same logs', () => {
    const logs = sampleLogs()
    const again = importLogbookCSV(exportLogbookCSV(logs, { [BTS.id]: BTS }), opts)
    expect(again.warnings).toEqual([])
    expect(again.logs).toEqual(logs)
  })

  it('round-trips app logs, normalising what the format cannot hold (times become local noon, feel/notes dropped)', () => {
    const logs = [
      mkLog({ week: 2, day: 1, doneAt: at('2026-03-31', 23, 30), feel: 5, note: 'late', ex: { 0: { v: 1, m: 'Rack 2', sets: [['100', '5'], ['100', '5'], ['105', '3']] } } }),
      mkLog({ week: 1, day: 0, done: false, doneAt: null, startedAt: at('2026-03-23', 18), unit: 'lb', ex: { 1: { sets: [['135', '8'], ['', '', false]] } } }),
      mkLog({ week: 1, day: 2, doneAt: at('2026-03-27'), ex: {} }), // finished with nothing logged
    ]
    const text = exportLogbookCSV(logs, [MINI])
    const back = importLogbookCSV(text, { memberId: 'stelios', program: MINI, now: NOW })
    expect(back.warnings).toEqual([])
    const norm = (l: WorkoutLog): WorkoutLog => ({
      ...l,
      doneAt: l.done ? noon(logDate(l)) : null,
      startedAt: null,
      feel: null,
      note: '',
      updatedAt: NOW,
    })
    const expected = logs.map(norm).sort((a, b) => a.week - b.week || a.day - b.day)
    expect(back.logs).toEqual(expected)
    // the finished-but-empty workout is written as a single marker row
    expect(parseCSV(text).filter((r) => r[2] === 'Full')).toEqual([['1', 'Base', 'Full', '', '', '', '', '', 'kg', '', '', '2026-03-27', '', '']])
  })

  it('marks sets beyond the prescription as extra and writes performed and program names', () => {
    const l = mkLog({ week: 1, day: 0, doneAt: at('2026-03-23'), ex: { 0: { v: 2, sets: [['80', '8'], ['80', '8'], ['70', '10']] } } })
    const rows = parseCSV(exportLogbookCSV([l], [MINI])).slice(1)
    expect(rows.map((r) => [r[3], r[4], r[5], r[6], r[12]])).toEqual([
      ['1', 'Machine Press', 'Bench Press', '1', 'no'],
      ['1', 'Machine Press', 'Bench Press', '2', 'no'],
      ['1', 'Machine Press', 'Bench Press', '3', 'yes'],
    ])
  })

  it('leaves out logs of unknown programs, weeks or exercises, and unfinished empty logs', () => {
    const logs = [
      mkLog({ week: 1, day: 0, program: { ...MINI, id: 'gone' }, ex: { 0: { sets: [['1', '1']] } } }),
      mkLog({ week: 9, day: 0, ex: { 0: { sets: [['1', '1']] } } }),
      mkLog({ week: 1, day: 0, ex: { 7: { sets: [['1', '1']] } }, done: false, doneAt: null }),
      mkLog({ week: 1, day: 1, done: false, doneAt: null }),
    ]
    expect(exportLogbookCSV(logs, [MINI])).toBe(HEADER + '\r\n')
  })

  it('writes the full day name when two days of a week share a short name', () => {
    const twin: Program = {
      ...MINI,
      id: 'twin',
      weeks: [{ block: 'A', intro: true, days: [{ name: 'Full (A)', ex: MINI.weeks[0].days[0].ex }, { name: 'Full (B)', ex: MINI.weeks[0].days[1].ex }] }],
    }
    const logs = [mkLog({ program: twin, week: 1, day: 1, doneAt: at('2026-03-25'), ex: { 0: { sets: [['100', '5']] } } })]
    const text = exportLogbookCSV(logs, [twin])
    expect(parseCSV(text)[1][2]).toBe('Full (B)')
    expect(importLogbookCSV(text, { memberId: 'stelios', program: twin, now: NOW }).logs[0].day).toBe(1)
  })

  it('supports a BOM and ; for Excel', () => {
    const text = exportLogbookCSV(sampleLogs(), [BTS], { bom: true, delimiter: ';' })
    expect(text.startsWith('﻿week;block;workout;')).toBe(true)
    expect(importLogbookCSV(text, opts).logs).toEqual(sampleLogs())
  })
})

describe('cell parsers', () => {
  it('parseYesNo', () => {
    expect(parseYesNo(' YES ')).toBe(true)
    expect(parseYesNo('όχι')).toBe(false)
    expect(parseYesNo('')).toBe(false)
    expect(parseYesNo('?')).toBeNull()
  })

  it('parseFinishDate', () => {
    expect(parseFinishDate('2026-03-23')).toBe('2026-03-23')
    expect(parseFinishDate('2026-03-23T19:04:00Z')).toBe('2026-03-23')
    expect(parseFinishDate('5/4/2026')).toBe('2026-04-05')
    expect(parseFinishDate('05.04.2026')).toBe('2026-04-05')
    expect(parseFinishDate('')).toBeNull()
    expect(parseFinishDate('31/2/2026')).toBeUndefined()
    expect(parseFinishDate('yesterday')).toBeUndefined()
  })
})
