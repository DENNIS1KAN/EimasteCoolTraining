import type { Cheer } from '../../../data/types'

/** The reactions offered on every feed item (emoji are user content here, not UI icons). */
export const KUDOS_EMOJI = ['🔥', '💪', '👏', '🏆'] as const

export interface KudosEntry {
  emoji: string
  count: number
  /** Reactors in the order they reacted. */
  fromIds: string[]
  /** The viewer's own reaction with this emoji, if any. */
  mine: Cheer | null
}

/**
 * Reactions on one item: the four standard emoji always come first (count 0 when unused), then any other
 * emoji people used, in order of first use. One reaction per person per emoji.
 */
export function kudosFor(kudos: Cheer[], itemId: string, viewerId: string | null): KudosEntry[] {
  const mine = kudos.filter((c) => c.kind === 'kudos' && c.ref === itemId).sort((a, b) => a.createdAt - b.createdAt)
  const map = new Map<string, KudosEntry>()
  for (const e of KUDOS_EMOJI) map.set(e, { emoji: e, count: 0, fromIds: [], mine: null })
  for (const c of mine) {
    const entry = map.get(c.emoji) ?? { emoji: c.emoji, count: 0, fromIds: [], mine: null }
    if (!entry.fromIds.includes(c.fromId)) {
      entry.fromIds.push(c.fromId)
      entry.count++
    }
    if (viewerId && c.fromId === viewerId && !entry.mine) entry.mine = c
    map.set(c.emoji, entry)
  }
  return [...map.values()]
}

/** Distinct people who reacted, in order of their first reaction. */
export function reactors(entries: KudosEntry[], kudos: Cheer[]): string[] {
  const ids = new Set(entries.flatMap((e) => e.fromIds))
  const ordered = [...kudos].sort((a, b) => a.createdAt - b.createdAt).map((c) => c.fromId)
  return [...new Set(ordered)].filter((id) => ids.has(id))
}

export type KudosChange = { type: 'put'; row: Cheer } | { type: 'remove'; id: string }

/** Toggle the viewer's reaction: remove it when present, otherwise add a new kudos cheer. */
export function toggleKudos(p: { entry: KudosEntry; itemId: string; toId: string; viewerId: string; id: string; now: number }): KudosChange | null {
  if (p.viewerId === p.toId) return null
  if (p.entry.mine) return { type: 'remove', id: p.entry.mine.id }
  return {
    type: 'put',
    row: {
      id: p.id,
      fromId: p.viewerId,
      toId: p.toId,
      kind: 'kudos',
      ref: p.itemId,
      emoji: p.entry.emoji,
      text: '',
      createdAt: p.now,
      seenAt: null,
      updatedAt: p.now,
    },
  }
}
