import type { Unit } from '../../../data/types'
import { roundToPlate } from '../../../lib/units'

export interface WarmupSet {
  /** Share of the working weight, 0..1. */
  pct: number
  /** Rounded to plates (2.5 kg / 5 lb); null when there is no working weight yet. */
  weight: number | null
  reps: string
}

/** The logbook's warm-up ramps by number of warm-up sets (1 to 4). */
const RAMPS: Record<1 | 2 | 3 | 4, [number, string][]> = {
  1: [[0.6, '6-10']],
  2: [
    [0.5, '6-10'],
    [0.7, '4-6'],
  ],
  3: [
    [0.45, '6-10'],
    [0.65, '4-6'],
    [0.85, '3-4'],
  ],
  4: [
    [0.45, '6-10'],
    [0.6, '4-6'],
    [0.75, '3-5'],
    [0.85, '2-4'],
  ],
}

/**
 * Warm-up ramp for a working weight. `count` is clamped to 1..4. Weights are rounded to plates and never
 * rounded down to nothing (a light isolation lift warms up with the smallest step).
 */
export function warmupRamp(workingWeight: number | null | undefined, count: number, unit: Unit): WarmupSet[] {
  const n = Math.min(4, Math.max(1, Math.round(count) || 1)) as 1 | 2 | 3 | 4
  const w = workingWeight != null && workingWeight > 0 ? workingWeight : null
  const step = unit === 'kg' ? 2.5 : 5
  return RAMPS[n].map(([pct, reps]) => ({
    pct,
    reps,
    weight: w == null ? null : Math.min(w, Math.max(step, roundToPlate(w * pct, unit))),
  }))
}
