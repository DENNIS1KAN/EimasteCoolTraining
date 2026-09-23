import { describe, expect, it } from 'vitest'
import { buildFeed } from '../../../lib/stats'
import { at, mkLog, mkMember, squad } from '../../../lib/testing/fixtures'
import type { Member, Post } from '../../../data/types'
import { matchesFilter } from '../logic/feedGroups'
import { canDelete, MAX_PHOTOS, MAX_TEXT } from './postActions'
import { unreadPosts } from './unread'

const post = (id: string, memberId: string, createdAt: number, text = 'hi'): Post => ({
  id,
  memberId,
  text,
  photos: [],
  createdAt,
  editedAt: null,
  updatedAt: createdAt,
})

const me = mkMember({ id: 'a', slug: 'a', name: 'Ann' })
const other = mkMember({ id: 'b', slug: 'b', name: 'Bob' })

describe('the merged stream', () => {
  it('interleaves what people said with what the app noticed, newest first', () => {
    const d = squad({
      members: [me, other],
      logs: [mkLog({ member: 'b', week: 1, day: 0, doneAt: at('2026-01-05', 9) })],
      posts: [post('p1', 'a', at('2026-01-05', 8)), post('p2', 'b', at('2026-01-05', 10))],
    })
    // a finished workout also earns a badge; this is about where the messages land around it
    const items = buildFeed(d).filter((i) => i.kind !== 'badge')
    expect(items.map((i) => i.kind)).toEqual(['post', 'workout', 'post'])
    expect(items[0].id).toBe('post:p2')
  })

  it('orders ties by id, so the stream does not reshuffle between renders', () => {
    const d = squad({ members: [me, other], posts: [post('zz', 'a', 1000), post('aa', 'b', 1000)] })
    expect(buildFeed(d).map((i) => i.id)).toEqual(['post:aa', 'post:zz'])
  })

  it('shows posts under the chat filter, not under workouts', () => {
    const d = squad({ members: [me], posts: [post('p1', 'a', 1000)] })
    const item = buildFeed(d)[0]
    expect(matchesFilter(item, 'chat')).toBe(true)
    expect(matchesFilter(item, 'workouts')).toBe(false)
    expect(matchesFilter(item, 'all')).toBe(true)
  })
})

describe('unread', () => {
  const posts = { p1: post('p1', 'b', 500), p2: post('p2', 'b', 1500), p3: post('p3', 'a', 2000) }

  it('counts what other people wrote since you last looked', () => {
    const seen = { ...me, settings: { ...me.settings, lastSeenPostAt: 1000 } } as Member
    expect(unreadPosts(posts, seen)).toBe(1)
  })

  it('never counts your own messages', () => {
    const fresh = { ...me, settings: { ...me.settings, lastSeenPostAt: null } } as Member
    expect(unreadPosts(posts, fresh)).toBe(2) // p1 and p2 from Bob; p3 is mine
  })

  it('is zero once everything has been seen, and for a signed-out viewer', () => {
    const caughtUp = { ...me, settings: { ...me.settings, lastSeenPostAt: 9999 } } as Member
    expect(unreadPosts(posts, caughtUp)).toBe(0)
    expect(unreadPosts(posts, null)).toBe(0)
  })
})

describe('deleting', () => {
  const p = post('p1', 'b', 1000)
  it('lets the author and the coach delete, nobody else', () => {
    expect(canDelete(p, { id: 'b', role: 'athlete' })).toBe(true)
    expect(canDelete(p, { id: 'a', role: 'coach' })).toBe(true)
    expect(canDelete(p, { id: 'a', role: 'athlete' })).toBe(false)
    expect(canDelete(p, null)).toBe(false)
  })
})

describe('limits', () => {
  it('keeps a post to four photos and a sane length', () => {
    expect(MAX_PHOTOS).toBe(4)
    expect(MAX_TEXT).toBeGreaterThan(500)
  })
})
