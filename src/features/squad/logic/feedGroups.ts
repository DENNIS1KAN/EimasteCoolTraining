import type { ISODate } from '../../../lib/dates'
import { isoFromMs } from '../../../lib/dates'
import type { FeedItem } from '../../../lib/stats'

export interface FeedDay {
  date: ISODate
  items: FeedItem[]
}

/** Split a newest-first feed into calendar days (local time), keeping the order. */
export function groupFeedByDay(items: FeedItem[]): FeedDay[] {
  const out: FeedDay[] = []
  for (const it of items) {
    const date = isoFromMs(it.at)
    const last = out[out.length - 1]
    if (last && last.date === date) last.items.push(it)
    else out.push({ date, items: [it] })
  }
  return out
}

export type FeedFilter = 'all' | 'chat' | 'workouts' | 'body'

export function matchesFilter(it: FeedItem, f: FeedFilter): boolean {
  switch (f) {
    case 'all':
      return true
    case 'chat':
      return it.kind === 'post' || it.kind === 'nudge' || it.kind === 'message'
    case 'workouts':
      return it.kind === 'workout' || it.kind === 'badge'
    case 'body':
      return it.kind === 'weighin' || it.kind === 'plan'
  }
}

/** Who receives kudos on an item: whoever did the thing (for a new meal plan, the coach who wrote it). */
export function kudosOwner(it: FeedItem): string {
  return it.kind === 'plan' ? it.byId || it.memberId : it.memberId
}
