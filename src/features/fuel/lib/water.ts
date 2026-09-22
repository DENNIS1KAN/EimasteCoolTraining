/** Water is logged in glasses of 0.25 L. */
export const GLASS_L = 0.25
/** Used when the plan has no water target. */
export const DEFAULT_WATER_L = 2.5

/** Glasses shown for a target: at least 4, at most 24. */
export function glassCount(targetL: number | null | undefined): number {
  const t = targetL && targetL > 0 ? targetL : DEFAULT_WATER_L
  return Math.min(24, Math.max(4, Math.ceil(t / GLASS_L - 1e-9)))
}

export const glassesOf = (l: number | null | undefined): number => (l && l > 0 ? Math.round(l / GLASS_L) : 0)

/**
 * Tap on glass `index` (0-based): fills every glass up to it, or, when it is the last full glass,
 * empties it (so a mistaken tap is undone by tapping again). Returns litres.
 */
export function tapGlass(currentL: number | null | undefined, index: number): number {
  const filled = glassesOf(currentL)
  const next = filled === index + 1 ? index : index + 1
  return Math.max(0, next) * GLASS_L
}
