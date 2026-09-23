import { useEffect } from 'react'
import { update } from '../../../data/store'
import type { Member, Post } from '../../../data/types'
import type { FeedItem } from '../../../lib/stats'

/**
 * Posts the viewer hasn't read. Their own never count: you don't have unread messages from yourself.
 * The marker lives on the member's own settings, which merge field by field, so the coach editing a
 * member's profile never resets that member's read position.
 */
export function unreadPosts(posts: Record<string, Post>, me: Member | null): number {
  if (!me) return 0
  const since = me.settings.lastSeenPostAt ?? 0
  let n = 0
  for (const p of Object.values(posts)) if (p.memberId !== me.id && p.createdAt > since) n++
  return n
}

/**
 * Mark the stream read while it is on screen. Idempotent: it writes only when the newest item is actually
 * newer than the stored marker, so simply looking at the chat doesn't queue an outbox write every render.
 */
export function useMarkChatSeen(me: Member | null, items: FeedItem[]): void {
  const newest = items.length ? Math.max(...items.map((i) => i.at)) : 0
  const seen = me?.settings.lastSeenPostAt ?? 0
  useEffect(() => {
    if (!me || !newest || newest <= seen) return
    update('members', me.id, (m) => ({ ...m, settings: { ...m.settings, lastSeenPostAt: newest } }))
  }, [me, newest, seen])
}
