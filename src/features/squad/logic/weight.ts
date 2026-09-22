import type { DeltaTone } from '../../../ui'

/**
 * Tone of a weight change relative to the member's goal: moving toward the goal weight is good, away from it
 * is a warning, and without a goal (or a negligible change) it's neutral.
 */
export function weightChangeTone(changeKg: number, startKg: number, goalKg: number | null | undefined): DeltaTone {
  if (Math.abs(changeKg) < 0.05 || goalKg == null || Math.abs(goalKg - startKg) < 0.05) return 'neutral'
  const wantDown = goalKg < startKg
  return (changeKg < 0) === wantDown ? 'good' : 'warn'
}

export const changeDir = (changeKg: number): 'up' | 'down' | 'flat' => (Math.abs(changeKg) < 0.05 ? 'flat' : changeKg > 0 ? 'up' : 'down')
