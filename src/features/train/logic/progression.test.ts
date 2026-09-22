import { describe, expect, it } from 'vitest'
import { loadStep, parseRepRange, suggestNext } from './progression'

describe('parseRepRange', () => {
  it('reads ranges written with a hyphen or an en dash, or a single number', () => {
    expect(parseRepRange('8-10')).toEqual([8, 10])
    expect(parseRepRange('12–15')).toEqual([12, 15])
    expect(parseRepRange('10')).toEqual([10, 10])
    expect(parseRepRange('10-8')).toEqual([8, 10])
  })
  it('passes tuples through and rejects text without numbers', () => {
    expect(parseRepRange([6, 8])).toEqual([6, 8])
    expect(parseRepRange('AMRAP')).toBeNull()
    expect(parseRepRange('')).toBeNull()
    expect(parseRepRange(undefined)).toBeNull()
  })
})

describe('suggestNext', () => {
  it('adds 2.5 kg at the bottom of the range when every set hit the top', () => {
    const s = suggestNext([{ weight: 55, reps: 10 }, { weight: 55, reps: 10 }], '8-10', 'kg')
    expect(s).toEqual({ kind: 'load', weight: 57.5, reps: 8, step: 2.5 })
  })

  it('adds 5 lb in pounds', () => {
    expect(suggestNext([{ weight: 135, reps: 12 }], '10-12', 'lb')).toEqual({ kind: 'load', weight: 140, reps: 10, step: 5 })
    expect(loadStep('lb')).toBe(5)
  })

  it('keeps the weight and asks for one more rep on the weakest set otherwise', () => {
    expect(suggestNext([{ weight: 55, reps: 10 }, { weight: 55, reps: 9 }], '8-10', 'kg')).toEqual({ kind: 'reps', weight: 55, reps: 10 })
    expect(suggestNext([{ weight: 80, reps: 7 }, { weight: 80, reps: 6 }], '6-8', 'kg')).toEqual({ kind: 'reps', weight: 80, reps: 7 })
  })

  it('never aims below the bottom or above the top of the range', () => {
    expect(suggestNext([{ weight: 60, reps: 4 }], '8-10', 'kg')).toEqual({ kind: 'reps', weight: 60, reps: 8 })
    expect(suggestNext([{ weight: 60, reps: 10 }, { weight: 60, reps: 11 }, { weight: 60, reps: 9 }], '8-10', 'kg')).toEqual({
      kind: 'reps',
      weight: 60,
      reps: 10,
    })
  })

  it('uses the heaviest set as the working weight (back-off sets do not drag it down)', () => {
    const s = suggestNext([{ weight: 100, reps: 6 }, { weight: 90, reps: 8 }], '6-8', 'kg')
    expect(s).toEqual({ kind: 'reps', weight: 100, reps: 7 })
  })

  it('counts a set above the top of the range as reaching it', () => {
    expect(suggestNext([{ weight: 20, reps: 13 }, { weight: 20, reps: 12 }], '10-12', 'kg')?.kind).toBe('load')
  })

  it('handles bodyweight sets (no weight)', () => {
    expect(suggestNext([{ weight: null, reps: 12 }, { weight: null, reps: 10 }], '10-20', 'kg')).toEqual({ kind: 'reps', weight: null, reps: 11 })
    expect(suggestNext([{ weight: null, reps: 20 }], '10-20', 'kg')).toEqual({ kind: 'load', weight: null, reps: 10, step: 2.5 })
  })

  it('avoids floating point noise', () => {
    expect(suggestNext([{ weight: 22.6, reps: 10 }], '8-10', 'kg')?.weight).toBe(25.1)
  })

  it('returns null without sets or without a rep range', () => {
    expect(suggestNext([], '8-10', 'kg')).toBeNull()
    expect(suggestNext([{ weight: 50, reps: 0 }], '8-10', 'kg')).toBeNull()
    expect(suggestNext([{ weight: 50, reps: 8 }], 'AMRAP', 'kg')).toBeNull()
  })
})
