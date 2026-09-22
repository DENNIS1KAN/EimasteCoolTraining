import { describe, expect, it } from 'vitest'
import { MINI, at, mkLog } from '../../../lib/testing/fixtures'
import type { Program } from '../../../data/types'
import { buildHistoryIndex, convertWeight, placeholderFor, previousPerformance } from './previous'

const programs: Record<string, Program> = { [MINI.id]: MINI }
const cur = (week: number, day: number) => ({ id: `stelios__mini__w${week}d${day}`, programId: MINI.id, week, day })

describe('previousPerformance', () => {
  const w1 = mkLog({ week: 1, day: 0, doneAt: at('2026-01-05'), ex: { 0: { sets: [['50', '10'], ['50', '9']] } } })
  const w1lower = mkLog({ week: 1, day: 1, doneAt: at('2026-01-07'), ex: { 0: { sets: [['100', '5']] } } })

  it('uses the same day slot of the latest earlier week', () => {
    const w2 = mkLog({ week: 2, day: 0, doneAt: at('2026-01-12'), ex: { 0: { sets: [['55', '10'], ['55', '9'], ['', '', false]] } } })
    const index = buildHistoryIndex([w1, w1lower, w2], programs)
    const p = previousPerformance(index, { ...cur(3, 0), programId: MINI.id }, 'Bench Press', 'kg')
    expect(p?.week).toBe(2)
    expect(p?.sets).toEqual([
      { w: '55', r: '10', weight: 55, reps: 10 },
      { w: '55', r: '9', weight: 55, reps: 9 },
    ])
  })

  it('never looks at later weeks of the same program or at the log itself', () => {
    const w2 = mkLog({ week: 2, day: 0, ex: { 0: { sets: [['55', '10']] } } })
    const index = buildHistoryIndex([w1, w2], programs)
    expect(previousPerformance(index, cur(1, 0), 'Bench Press', 'kg')).toBeNull()
    expect(previousPerformance(index, cur(2, 0), 'Bench Press', 'kg')?.week).toBe(1)
  })

  it('falls back to the latest earlier session on another day (e.g. after a swap)', () => {
    // week 1 upper performed the DB Press swap; week 2 full day does not have it, so look by name anywhere
    const swapped = mkLog({ week: 1, day: 0, doneAt: at('2026-01-05'), ex: { 0: { v: 1, sets: [['24', '10']] } } })
    const index = buildHistoryIndex([swapped], programs)
    expect(previousPerformance(index, cur(2, 2), 'DB Press', 'kg')?.sets[0].w).toBe('24')
    expect(previousPerformance(index, cur(2, 0), 'Bench Press', 'kg')).toBeNull()
  })

  it('only counts ticked sets, or all sets with reps once the workout was finished', () => {
    const open = mkLog({ week: 1, day: 0, done: false, ex: { 0: { sets: [['50', '10', true], ['50', '8', false]] } } })
    const p = previousPerformance(buildHistoryIndex([open], programs), cur(2, 0), 'Bench Press', 'kg')
    expect(p?.sets).toHaveLength(1)
  })

  it('ignores logs without counted sets for the exercise', () => {
    const empty = mkLog({ week: 1, day: 0, done: false, ex: { 0: { sets: [['50', '', false]] } } })
    expect(previousPerformance(buildHistoryIndex([empty], programs), cur(2, 0), 'Bench Press', 'kg')).toBeNull()
  })

  it('converts between units', () => {
    const lb = mkLog({ week: 1, day: 0, unit: 'lb', ex: { 0: { sets: [['135', '8']] } } })
    const p = previousPerformance(buildHistoryIndex([lb], programs), cur(2, 0), 'Bench Press', 'kg')
    expect(p?.sets[0]).toEqual({ w: '61', r: '8', weight: 61, reps: 8 })
  })

  it('keeps bodyweight sets without a weight', () => {
    const bw = mkLog({ week: 1, day: 2, ex: { 0: { sets: [['', '12']] } } })
    const p = previousPerformance(buildHistoryIndex([bw], programs), cur(2, 2), 'Pull-Up', 'kg')
    expect(p?.sets[0]).toEqual({ w: '', r: '12', weight: null, reps: 12 })
  })
})

describe('convertWeight', () => {
  it('keeps the typed text in the same unit and rounds conversions to half units', () => {
    expect(convertWeight(' 57,5 ', 'kg', 'kg')).toBe('57,5')
    expect(convertWeight('100', 'kg', 'lb')).toBe('220.5')
    expect(convertWeight('abc', 'kg', 'lb')).toBe('')
  })
})

describe('placeholderFor', () => {
  const prev = { logId: 'x', programId: MINI.id, week: 1, day: 0, at: 0, sets: [{ w: '55', r: '10', weight: 55, reps: 10 }, { w: '55', r: '9', weight: 55, reps: 9 }] }
  it("uses last time's set, or its last set for extra sets", () => {
    expect(placeholderFor(prev, 0, undefined)).toEqual({ w: '55', r: '10' })
    expect(placeholderFor(prev, 3, undefined)).toEqual({ w: '55', r: '9' })
  })
  it('falls back to the weight typed above', () => {
    expect(placeholderFor(null, 1, { w: '60' })).toEqual({ w: '60', r: '' })
    expect(placeholderFor(null, 0, undefined)).toBeNull()
    expect(placeholderFor({ ...prev, sets: [] }, 1, { w: ' ' })).toBeNull()
  })
})
