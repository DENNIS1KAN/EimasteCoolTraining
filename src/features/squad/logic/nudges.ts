import type { Cheer } from '../../../data/types'

/** One nudge per sender and recipient every 6 hours. */
export const NUDGE_COOLDOWN_MS = 6 * 60 * 60 * 1000
/** Maximum length of a custom nudge (in characters as people count them, so an emoji is one). */
export const NUDGE_MAX = 140

/** Replies ("Cheer back") point at the cheer they answer; they don't use up the sender's nudge. */
export const REPLY_PREFIX = 'cheer:'
export const isReply = (c: Pick<Cheer, 'ref'>): boolean => !!c.ref && c.ref.startsWith(REPLY_PREFIX)

/** When `fromId` last nudged `toId` (replies excluded), or null. */
export function lastNudgeAt(cheers: Record<string, Cheer> | Cheer[], fromId: string, toId: string): number | null {
  let last: number | null = null
  for (const c of Array.isArray(cheers) ? cheers : Object.values(cheers)) {
    if (c.kind !== 'nudge' || c.fromId !== fromId || c.toId !== toId || isReply(c)) continue
    if (last == null || c.createdAt > last) last = c.createdAt
  }
  return last
}

export interface NudgeState {
  canNudge: boolean
  /** Last nudge from this sender to this recipient. */
  lastAt: number | null
  /** When the next nudge is allowed (null when it already is). */
  readyAt: number | null
}

export function nudgeState(cheers: Record<string, Cheer> | Cheer[], fromId: string, toId: string, now: number): NudgeState {
  if (fromId === toId) return { canNudge: false, lastAt: null, readyAt: null }
  const lastAt = lastNudgeAt(cheers, fromId, toId)
  const readyAt = lastAt != null && now - lastAt < NUDGE_COOLDOWN_MS ? lastAt + NUDGE_COOLDOWN_MS : null
  return { canNudge: readyAt == null, lastAt, readyAt }
}

/** Trim, collapse runs of whitespace and cap at NUDGE_MAX characters without splitting an emoji. */
export function cleanNudgeText(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  const chars = Array.from(t)
  return chars.length > NUDGE_MAX ? chars.slice(0, NUDGE_MAX).join('').trim() : t
}

/** Number of characters as the counter shows them. */
export const charCount = (s: string): number => Array.from(s).length

export function makeNudge(p: { id: string; fromId: string; toId: string; text: string; emoji: string; now: number }): Cheer {
  return {
    id: p.id,
    fromId: p.fromId,
    toId: p.toId,
    kind: 'nudge',
    ref: null,
    emoji: p.emoji,
    text: cleanNudgeText(p.text),
    createdAt: p.now,
    seenAt: null,
    updatedAt: p.now,
  }
}

/** A quick 💪 back to whoever nudged or messaged you. */
export function makeCheerBack(p: { id: string; original: Cheer; text: string; now: number }): Cheer {
  return {
    id: p.id,
    fromId: p.original.toId,
    toId: p.original.fromId,
    kind: 'nudge',
    ref: `${REPLY_PREFIX}${p.original.id}`,
    emoji: '💪',
    text: cleanNudgeText(p.text),
    createdAt: p.now,
    seenAt: null,
    updatedAt: p.now,
  }
}

/** "Time to train! 💪": the text with its emoji, without doubling an emoji the text already ends with. */
export function cheerLine(c: Pick<Cheer, 'text' | 'emoji'>): string {
  const text = c.text.trim()
  if (!c.emoji) return text
  if (!text) return c.emoji
  return text.endsWith(c.emoji) ? text : `${text} ${c.emoji}`
}
