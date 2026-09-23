import { useEffect, useMemo, useState } from 'react'
import { update, useMe, useStore } from '../../../data/store'
import { useT } from '../../../i18n'
import { fmtDayLabel } from '../../../lib/format'
import { buildFeed } from '../../../lib/stats'
import { Button, Card, Chip, EmptyState } from '../../../ui'
import { useStreamData } from '../hooks'
import { groupFeedByDay, matchesFilter, type FeedFilter } from '../logic/feedGroups'
import { SQ } from '../messages'
import { FeedItemView } from './FeedItemView'
import { Composer } from './Composer'
import { deletePost } from './postActions'
import { useMarkChatSeen } from './unread'

const PAGE = 30
const FILTERS: { value: FeedFilter; label: 'filterAll' | 'filterChat' | 'filterWorkouts' | 'filterBody' }[] = [
  { value: 'all', label: 'filterAll' },
  { value: 'chat', label: 'filterChat' },
  { value: 'workouts', label: 'filterWorkouts' },
  { value: 'body', label: 'filterBody' },
]

/** Nudges and messages addressed to the viewer are marked seen while the feed is on screen. */
function useMarkSeen(meId: string | null) {
  const unseen = useStore((s) => {
    if (!meId) return [] as string[]
    const ids: string[] = []
    for (const c of Object.values(s.cheers)) if (c.toId === meId && !c.seenAt && c.kind !== 'kudos') ids.push(c.id)
    return ids
  })
  useEffect(() => {
    if (!unseen.length) return
    const now = Date.now()
    for (const id of unseen) update('cheers', id, { seenAt: now })
  }, [unseen])
}

/**
 * Whether a horizontal scroller has more content past its right edge (for the fade cue). A callback ref, since
 * the row mounts only once the feed has items; re-checked on scroll and when the row or a chip resizes.
 */
function useMoreToRight(): [(el: HTMLElement | null) => void, boolean] {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    if (!el) return
    const check = () => setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 1)
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check)
    if (ro) {
      ro.observe(el)
      for (const c of Array.from(el.children)) ro.observe(c)
    }
    return () => {
      el.removeEventListener('scroll', check)
      ro?.disconnect()
    }
  }, [el])
  return [setEl, more]
}

export function ChatTab() {
  const t = useT(SQ)
  const me = useMe()
  const data = useStreamData()
  const postsById = useStore((s) => s.posts)
  const [filter, setFilter] = useState<FeedFilter>('all')
  const [limit, setLimit] = useState(PAGE)
  const [filtersRef, moreFilters] = useMoreToRight()
  useMarkSeen(me?.id ?? null)

  const all = useMemo(() => buildFeed(data), [data])
  useMarkChatSeen(me ?? null, all)
  const items = useMemo(() => all.filter((i) => matchesFilter(i, filter)), [all, filter])
  const days = useMemo(() => groupFeedByDay(items.slice(0, limit)), [items, limit])
  const unit = me?.settings.unit ?? 'kg'
  const onDelete = (id: string) => {
    const p = postsById[id]
    if (p) void deletePost(p)
  }

  if (!all.length) {
    return (
      <div className="stack sq-feed sq-feed--empty">
        <EmptyState icon="message" title={t('chatEmptyTitle')} body={t('chatEmptyBody')} />
        <Composer />
      </div>
    )
  }

  return (
    <div className="stack sq-feed">
      <div ref={filtersRef} className={`sq-filters${moreFilters ? ' has-more' : ''}`} role="group" aria-label={t('feedFilter')}>
        {FILTERS.map((f) => (
          <Chip
            key={f.value}
            selected={filter === f.value}
            onClick={() => {
              setFilter(f.value)
              setLimit(PAGE)
            }}
          >
            {t(f.label)}
          </Chip>
        ))}
      </div>
      {days.length === 0 ? <EmptyState compact icon="filter" title={t('feedFilterEmpty')} /> : null}
      {days.map((d) => (
        <section key={d.date} className="sq-feed__day" aria-label={fmtDayLabel(d.date)}>
          <h2 className="eyebrow sq-feed__date">{fmtDayLabel(d.date)}</h2>
          <Card padding="none" className="sq-feed__card">
            {d.items.map((it) => (
              <FeedItemView key={it.id} item={it} members={data.members} me={me} unit={unit} onDelete={onDelete} />
            ))}
          </Card>
        </section>
      ))}
      {items.length > limit && (
        <Button variant="ghost" block onClick={() => setLimit((n) => n + PAGE)}>
          {t('showMore')}
        </Button>
      )}
      <Composer />
    </div>
  )
}
