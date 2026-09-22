import { describe, expect, it } from 'vitest'
import { warmupRamp } from './warmup'

const weights = (xs: ReturnType<typeof warmupRamp>) => xs.map((x) => x.weight)

describe('warmupRamp', () => {
  it('follows the logbook ramps for 1 to 4 warm-up sets', () => {
    expect(warmupRamp(100, 1, 'kg')).toEqual([{ pct: 0.6, weight: 60, reps: '6-10' }])
    expect(warmupRamp(100, 2, 'kg').map((x) => [x.pct, x.reps])).toEqual([
      [0.5, '6-10'],
      [0.7, '4-6'],
    ])
    expect(warmupRamp(100, 3, 'kg').map((x) => [x.pct, x.reps])).toEqual([
      [0.45, '6-10'],
      [0.65, '4-6'],
      [0.85, '3-4'],
    ])
    expect(warmupRamp(100, 4, 'kg').map((x) => [x.pct, x.reps])).toEqual([
      [0.45, '6-10'],
      [0.6, '4-6'],
      [0.75, '3-5'],
      [0.85, '2-4'],
    ])
  })

  it('rounds to 2.5 kg plates', () => {
    expect(weights(warmupRamp(57.5, 3, 'kg'))).toEqual([25, 37.5, 50])
    expect(weights(warmupRamp(80, 2, 'kg'))).toEqual([40, 55])
  })

  it('rounds to 5 lb plates', () => {
    expect(weights(warmupRamp(225, 4, 'lb'))).toEqual([100, 135, 170, 190])
  })

  it('clamps the set count', () => {
    expect(warmupRamp(100, 0, 'kg')).toHaveLength(1)
    expect(warmupRamp(100, 9, 'kg')).toHaveLength(4)
  })

  it('never rounds a warm-up down to zero or above the working weight', () => {
    expect(weights(warmupRamp(5, 2, 'kg'))).toEqual([2.5, 2.5])
    expect(weights(warmupRamp(2, 1, 'kg'))).toEqual([2])
  })

  it('has no weights without a working weight', () => {
    expect(weights(warmupRamp(null, 2, 'kg'))).toEqual([null, null])
    expect(weights(warmupRamp(0, 1, 'kg'))).toEqual([null])
  })
})
