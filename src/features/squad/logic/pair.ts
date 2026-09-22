import type { Member } from '../../../data/types'

/**
 * Your rival: among the other competitors, the one closest to you in all-time points (a fair fight),
 * falling back to list order. Null when you don't compete or nobody else does.
 */
export function rivalOf(competitors: Member[], viewer: Member | null | undefined, pointsById: Record<string, number> = {}): Member | null {
  if (!viewer || !competitors.some((m) => m.id === viewer.id)) return null
  const others = competitors.filter((m) => m.id !== viewer.id)
  if (!others.length) return null
  const mine = pointsById[viewer.id] ?? 0
  let best = others[0]
  let bestGap = Math.abs((pointsById[best.id] ?? 0) - mine)
  for (const m of others.slice(1)) {
    const gap = Math.abs((pointsById[m.id] ?? 0) - mine)
    if (gap < bestGap) {
      best = m
      bestGap = gap
    }
  }
  return best
}

/** Default head-to-head: you vs your rival; for non-competitors (the coach) the first two competitors. */
export function defaultPair(competitors: Member[], viewer: Member | null | undefined, pointsById?: Record<string, number>): [Member, Member] | null {
  const rival = rivalOf(competitors, viewer, pointsById)
  if (viewer && rival) return [viewer, rival]
  return competitors.length >= 2 ? [competitors[0], competitors[1]] : null
}

/**
 * The pair from the URL (?a=<slug>&b=<slug>), repaired when a slug is unknown or both are the same person:
 * a missing side is filled with the default pair's member that isn't already on the other side.
 */
export function resolvePair(
  competitors: Member[],
  viewer: Member | null | undefined,
  aSlug: string | null | undefined,
  bSlug: string | null | undefined,
  pointsById?: Record<string, number>,
): [Member, Member] | null {
  if (competitors.length < 2) return null
  const find = (slug: string | null | undefined) => (slug ? (competitors.find((m) => m.slug === slug) ?? null) : null)
  let a = find(aSlug)
  let b = find(bSlug)
  if (a && b && a.id === b.id) b = null
  if (a && b) return [a, b]
  const def = defaultPair(competitors, viewer, pointsById)!
  const pool = [...def, ...competitors]
  if (!a) a = pool.find((m) => m.id !== b?.id) ?? null
  if (!b) b = pool.find((m) => m.id !== a?.id) ?? null
  return a && b ? [a, b] : null
}
