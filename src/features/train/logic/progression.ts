import type { Unit } from '../../../data/types'

/** A previous working set, with the weight already in the unit the suggestion is for (null = bodyweight). */
export interface PrevSet {
  weight: number | null
  reps: number
}

export type RepRange = [lo: number, hi: number]

/**
 * "8-10" -> [8, 10], "12–15" -> [12, 15], "10" -> [10, 10]. null when there is no number (e.g. "AMRAP").
 * The bounds are sorted, so "10-8" still reads as 8 to 10.
 */
export function parseRepRange(r: string | RepRange | null | undefined): RepRange | null {
  if (Array.isArray(r)) return r
  const nums = (r ?? '').match(/\d+/g)?.map(Number).filter((n) => n > 0)
  if (!nums?.length) return null
  const lo = nums[0]
  const hi = nums[1] ?? nums[0]
  return lo <= hi ? [lo, hi] : [hi, lo]
}

/** Progression step for the unit: 2.5 kg or 5 lb. */
export const loadStep = (unit: Unit): number => (unit === 'lb' ? 5 : 2.5)

export type Suggestion =
  /** Every set reached the top of the range: add load and start again at the bottom of the range. */
  | { kind: 'load'; weight: number | null; reps: number; step: number }
  /** Same weight, one more rep on the weakest set (capped at the top of the range). */
  | { kind: 'reps'; weight: number | null; reps: number }

/**
 * Double progression, from last time's working sets:
 * - every set reached the top of the rep range -> +2.5 kg / +5 lb at the bottom of the range;
 * - otherwise the same weight, aiming for one more rep on the weakest set.
 * The working weight is the heaviest set; bodyweight sets (no weight) keep weight null.
 * Returns null without usable sets or rep range.
 */
export function suggestNext(prevSets: PrevSet[], repRange: string | RepRange | null | undefined, unit: Unit): Suggestion | null {
  const range = parseRepRange(repRange)
  const sets = prevSets.filter((s) => s.reps > 0 && (s.weight == null || s.weight >= 0))
  if (!range || !sets.length) return null
  const [lo, hi] = range
  const weights = sets.map((s) => s.weight ?? 0)
  const top = Math.max(...weights)
  const weight = top > 0 ? top : null
  const working = weight == null ? sets : sets.filter((s) => (s.weight ?? 0) === top)
  if (sets.every((s) => s.reps >= hi)) {
    const step = loadStep(unit)
    return { kind: 'load', weight: weight == null ? null : round2(weight + step), reps: lo, step }
  }
  const weakest = Math.min(...working.map((s) => s.reps))
  return { kind: 'reps', weight, reps: Math.min(hi, Math.max(lo, weakest + 1)) }
}

const round2 = (n: number) => Math.round(n * 100) / 100
