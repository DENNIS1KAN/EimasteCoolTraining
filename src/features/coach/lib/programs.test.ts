import { describe, expect, it } from 'vitest'
import { BTS_PROGRAM } from '../../../data/programs'
import { MINI, mkMember } from '../../../lib/testing/fixtures'
import {
  blockGroups,
  enDash,
  focusAbbr,
  membersOnProgram,
  programEnd,
  programIdFromName,
  programSummary,
  shortRandom,
  sortPrograms,
  splitApprox,
  techniqueOf,
  weekdayIndex,
  weeklyPattern,
} from './programs'

describe('programSummary', () => {
  it('counts weeks, days and exercises', () => {
    const s = programSummary(MINI)
    expect(s).toMatchObject({ weeks: 2, daysPerWeek: 3, workouts: 6, exerciseSlots: 12, uniqueExercises: 6, exercisesPerWeek: 6, blocks: ['Base'] })
  })
  it('summarises BTS', () => {
    const s = programSummary(BTS_PROGRAM)
    expect(s.weeks).toBe(12)
    expect(s.daysPerWeek).toBe(5)
    expect(s.workouts).toBe(60)
    expect(s.blocks.length).toBeGreaterThanOrEqual(2)
  })
})

describe('programIdFromName', () => {
  it('slugs the name and appends a random suffix', () => {
    expect(programIdFromName('Summer Cut 2026', 'abc12')).toBe('summer-cut-2026-abc12')
    expect(programIdFromName('Πρόγραμμα Όγκου', 'x')).toBe('programma-ogkou-x')
    expect(programIdFromName('!!!', 'x')).toBe('program-x')
  })
  it('shortRandom gives base-36 strings of the asked length', () => {
    expect(shortRandom()).toMatch(/^[a-z0-9]{5}$/)
    expect(shortRandom(8)).toMatch(/^[a-z0-9]{8}$/)
  })
})

describe('weeklyPattern', () => {
  it('maps the 7 slots to day names', () => {
    const p = weeklyPattern(MINI)
    expect(p.map((s) => s.label)).toEqual(['Upper', '', 'Lower', '', 'Full', '', ''])
    expect(p[2]).toEqual({ slot: 2, day: 1, label: 'Lower' })
  })
  it('ignores slots pointing at missing days', () => {
    const p = weeklyPattern({ weeks: MINI.weeks, schedule: [0, 7, null, null, null, null, null] })
    expect(p[1]).toEqual({ slot: 1, day: null, label: '' })
  })
})

describe('misc', () => {
  it('membersOnProgram / sortPrograms', () => {
    const ms = [mkMember({ id: 'a' }), mkMember({ id: 'b', programId: 'x' })]
    expect(membersOnProgram(ms, MINI.id).map((m) => m.id)).toEqual(['a'])
    const imported = { ...MINI, id: 'b', name: 'Alpha' }
    expect(sortPrograms([imported, BTS_PROGRAM, MINI]).map((p) => p.id)).toEqual(['bts-12', 'b', 'mini'])
  })
  it('programEnd / weekdayIndex', () => {
    expect(programEnd(BTS_PROGRAM, '2026-09-07')).toBe('2026-11-29')
    expect(weekdayIndex('2026-09-07')).toBe(0)
    expect(weekdayIndex('2026-09-13')).toBe(6)
  })
})

describe('exercise text helpers', () => {
  it('enDash / splitApprox', () => {
    expect(enDash('8-10')).toBe('8–10')
    expect(enDash('2 - 3 min')).toBe('2–3 min')
    expect(enDash('Myo-reps')).toBe('Myo-reps')
    expect(splitApprox('~8-9')).toEqual({ approx: true, value: '8–9' })
    expect(splitApprox('10')).toEqual({ approx: false, value: '10' })
    expect(splitApprox(undefined)).toEqual({ approx: false, value: '' })
  })
  it('techniqueOf / focusAbbr', () => {
    expect(techniqueOf('N/A')).toBeNull()
    expect(techniqueOf(' na ')).toBeNull()
    expect(techniqueOf('')).toBeNull()
    expect(techniqueOf('Failure')).toBe('Failure')
    expect(focusAbbr('Upper (Strength Focus)')).toBe('STR')
    expect(focusAbbr('Legs (Hypertrophy Focus)')).toBe('HYP')
    expect(focusAbbr('Full')).toBe('')
    expect(focusAbbr('Πάνω (Ύψος έντασης)')).toBe('ΥΨΟ')
  })
  it('blockGroups', () => {
    expect(blockGroups(BTS_PROGRAM).map((g) => [g.block, g.weeks[0], g.weeks[g.weeks.length - 1]])).toEqual([
      [BTS_PROGRAM.weeks[0].block, 1, 5],
      [BTS_PROGRAM.weeks[11].block, 6, 12],
    ])
    expect(blockGroups({ weeks: [] })).toEqual([])
  })
})
