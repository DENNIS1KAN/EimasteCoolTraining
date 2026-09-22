import type { Unit } from '../data/types'

export const LB_PER_KG = 2.2046226218

export const kgToUnit = (kg: number, unit: Unit): number => (unit === 'lb' ? kg * LB_PER_KG : kg)
export const unitToKg = (v: number, unit: Unit): number => (unit === 'lb' ? v / LB_PER_KG : v)

const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)$/

/**
 * Parse a user-typed number that may use a decimal comma ("80,5"). Returns null when empty/invalid.
 * Only plain decimals are accepted: no thousands separators, units, exponents or hex.
 */
export function parseNum(s: string | number | null | undefined): number | null {
  if (s == null) return null
  if (typeof s === 'number') return Number.isFinite(s) ? s : null
  const t = s.trim().replace(',', '.')
  if (!DECIMAL.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Round to the nearest plate step (2.5 kg / 5 lb). */
export const roundToPlate = (x: number, unit: Unit): number => {
  const step = unit === 'kg' ? 2.5 : 5
  return Math.round(x / step) * step
}
