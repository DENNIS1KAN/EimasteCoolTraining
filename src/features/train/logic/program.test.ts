import { describe, expect, it } from 'vitest'
import { MINI, mkLog } from '../../../lib/testing/fixtures'
import { BTS_PROGRAM } from '../../../data/programs'
import { blockGroups, clampRef, doneKeys, estimateMinutes, focusOf, totalSets, weekCompletion, weekDayStates } from './program'

describe('focusOf', () => {
  it('reads the focus from the day name', () => {
    expect(focusOf({ name: 'Upper (Strength Focus)' })).toBe('str')
    expect(focusOf({ name: 'Pull (Hypertrophy Focus)' })).toBe('hyp')
    expect(focusOf({ name: 'Full (Pump)' })).toBe('hyp')
    expect(focusOf({ name: 'Arms' })).toBeNull()
  })
})

describe('blockGroups', () => {
  it('groups consecutive weeks by block and drops the word "Block"', () => {
    expect(blockGroups(BTS_PROGRAM)).toEqual([
      { label: 'Foundation', from: 1, to: 5 },
      { label: 'Ramping', from: 6, to: 12 },
    ])
    expect(blockGroups(MINI)).toEqual([{ label: 'Base', from: 1, to: 2 }])
  })
})

describe('weekCompletion / weekDayStates', () => {
  const logs = [mkLog({ week: 1, day: 0 }), mkLog({ week: 1, day: 1 }), mkLog({ week: 2, day: 0, done: false })]
  const done = doneKeys(logs, MINI.id)

  it('counts done workouts per week', () => {
    expect(weekCompletion(MINI, done)).toEqual([2 / 3, 0])
    expect(doneKeys(logs, 'other').size).toBe(0)
  })

  it('marks done, today, missed and upcoming days', () => {
    // MINI: Mon / Wed / Fri; start Monday 2026-01-05
    expect(weekDayStates(MINI, '2026-01-05', 1, done, '2026-01-09')).toEqual(['done', 'done', 'today'])
    expect(weekDayStates(MINI, '2026-01-05', 2, done, '2026-01-14')).toEqual(['missed', 'today', 'upcoming'])
    expect(weekDayStates(MINI, null, 2, done, '2026-01-14')).toEqual(['upcoming', 'upcoming', 'upcoming'])
  })
})

describe('estimateMinutes', () => {
  it('adds rest + 45 s per working set and a minute per warm-up set, rounded to 5', () => {
    // MINI upper: 2 exercises x 2 sets x (120 + 45) s + 2 x 60 s warm-up = 780 s = 13 min -> 15
    expect(estimateMinutes(MINI.weeks[0].days[0])).toBe(15)
    expect(totalSets(MINI.weeks[0].days[0])).toBe(4)
  })

  it('gives a realistic hour for a BTS day', () => {
    const m = estimateMinutes(BTS_PROGRAM.weeks[2].days[2])
    expect(m).toBeGreaterThanOrEqual(45)
    expect(m).toBeLessThanOrEqual(90)
  })
})

describe('clampRef', () => {
  it('keeps refs inside the program', () => {
    expect(clampRef(MINI, 2, 1)).toEqual({ week: 2, day: 1 })
    expect(clampRef(MINI, 9, 7)).toEqual({ week: 2, day: 2 })
    expect(clampRef(MINI, 0, -1)).toEqual({ week: 1, day: 0 })
    expect(clampRef(MINI, Number.NaN, Number.NaN)).toEqual({ week: 1, day: 0 })
  })
})
