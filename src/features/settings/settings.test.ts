import { describe, expect, it } from 'vitest'
import { at, MINI, mkCheer, mkLog, mkMember, mkWeight } from '../../lib/testing/fixtures'
import { parseCSV } from '../../lib/import/csv'
import { importLogbookCSV, LOGBOOK_CSV_COLUMNS } from '../../lib/import/logbook'
import type { WorkoutLog } from '../../data/types'
import { inferProgramStart, logsToWrite, summarizeImport } from './importPlan'
import { buildMyData, exportFileName, myWorkoutsCSV } from './exportData'

const index = (logs: WorkoutLog[]) => Object.fromEntries(logs.map((l) => [l.id, l]))

describe('summarizeImport', () => {
  const logs = [
    mkLog({ week: 1, day: 0, doneAt: at('2026-03-23'), ex: { 0: { sets: [['30', '8'], ['32.5', '7'], ['', '', false]] } } }),
    mkLog({ week: 1, day: 1, done: false, doneAt: null, ex: { 0: { sets: [['60', '8', false]] } } }),
    mkLog({ week: 2, day: 0, doneAt: at('2026-03-30'), ex: { 0: { sets: [['35', '8']] }, 1: { sets: [['15', '10']] } } }),
  ]

  it('counts workouts, finished ones, filled sets, the date span and the last week', () => {
    expect(summarizeImport(logs, {})).toEqual({
      workouts: 3,
      finished: 2,
      sets: 5,
      existing: 0,
      firstDate: '2026-03-23',
      lastDate: '2026-03-30',
      lastWeek: 2,
    })
  })

  it('counts workouts that already exist', () => {
    expect(summarizeImport(logs, index([logs[0]])).existing).toBe(1)
  })

  it('handles an empty import', () => {
    expect(summarizeImport([], {})).toEqual({ workouts: 0, finished: 0, sets: 0, existing: 0, firstDate: null, lastDate: null, lastWeek: 0 })
  })
})

describe('logsToWrite', () => {
  const a = mkLog({ week: 1, day: 0 })
  const b = mkLog({ week: 1, day: 1 })
  it('skips existing workouts unless overwrite is on', () => {
    expect(logsToWrite([a, b], index([a]), false)).toEqual([b])
    expect(logsToWrite([a, b], index([a]), true)).toEqual([a, b])
    expect(logsToWrite([a, b], {}, false)).toEqual([a, b])
  })
})

describe('inferProgramStart', () => {
  it('is the Monday of the earliest finished workout, moved back by its program week', () => {
    // Wed 25 Mar 2026 in week 1 -> Mon 23 Mar
    expect(inferProgramStart([mkLog({ week: 1, day: 1, doneAt: at('2026-03-25') })])).toBe('2026-03-23')
    // Only week 2 known: Thu 2 Apr (week of Mon 30 Mar) -> start Mon 23 Mar
    expect(inferProgramStart([mkLog({ week: 2, day: 2, doneAt: at('2026-04-02') }), mkLog({ week: 3, day: 0, doneAt: at('2026-04-06') })])).toBe('2026-03-23')
  })
  it('ignores unfinished workouts and returns null without any', () => {
    expect(inferProgramStart([mkLog({ week: 1, day: 0, done: false, doneAt: null })])).toBeNull()
    expect(inferProgramStart([])).toBeNull()
  })
})

describe('buildMyData', () => {
  const me = mkMember({ id: 'stelios' })
  const other = 'thanos'
  const tables = {
    logs: index([mkLog({ week: 1, day: 1 }), mkLog({ week: 1, day: 0 }), mkLog({ member: other, week: 1, day: 0 })]),
    weights: Object.fromEntries([mkWeight('stelios', '2026-03-24', 81), mkWeight('stelios', '2026-03-23', 82), mkWeight(other, '2026-03-23', 70)].map((w) => [w.id, w])),
    mealPlans: {},
    checkins: {},
    cheers: Object.fromEntries(
      [
        mkCheer({ fromId: other, toId: 'stelios', kind: 'kudos', createdAt: 2 }),
        mkCheer({ fromId: 'stelios', toId: other, kind: 'nudge', createdAt: 1 }),
        mkCheer({ fromId: other, toId: 'dennis', kind: 'kudos', createdAt: 3 }),
      ].map((c) => [c.id, c]),
    ),
    programs: { [MINI.id]: MINI },
  }

  it('keeps only my rows, sorted, plus the custom programs my logs use', () => {
    const d = buildMyData(me, tables, '1.2.3', at('2026-09-22', 12))
    expect(d.app).toBe('eimaste-cool-training')
    expect(d.version).toBe('1.2.3')
    expect(d.member).toBe(me)
    expect(d.logs.map((l) => l.id)).toEqual(['stelios__mini__w1d0', 'stelios__mini__w1d1'])
    expect(d.weights.map((w) => w.date)).toEqual(['2026-03-23', '2026-03-24'])
    expect(d.cheers.map((c) => c.kind)).toEqual(['nudge', 'kudos'])
    expect(d.programs.map((p) => p.id)).toEqual(['mini'])
    expect(JSON.parse(JSON.stringify(d)).exportedAt).toBe(new Date(at('2026-09-22', 12)).toISOString())
  })

  it('writes my workouts as a logbook CSV that imports back', () => {
    const logs = [mkLog({ week: 1, day: 0, doneAt: at('2026-01-05'), ex: { 0: { sets: [['40', '8'], ['42.5', '6']] } } })]
    const csv = myWorkoutsCSV(me, { logs: index([...logs, mkLog({ member: other, week: 1, day: 0 })]), programs: { [MINI.id]: MINI } })
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const rows = parseCSV(csv)
    expect(rows[0]).toEqual([...LOGBOOK_CSV_COLUMNS])
    expect(rows).toHaveLength(3)
    const back = importLogbookCSV(csv, { memberId: 'stelios', program: MINI, now: 1 })
    expect(back.warnings).toEqual([])
    expect(back.logs[0].ex['0'].sets.map((s) => s.w)).toEqual(['40', '42.5'])
  })

  it('names export files by member and date', () => {
    expect(exportFileName('stelios', '2026-09-22', 'data')).toBe('eimaste-cool-stelios-2026-09-22.json')
    expect(exportFileName('stelios', '2026-09-22', 'workouts')).toBe('eimaste-cool-stelios-workouts-2026-09-22.csv')
  })
})
