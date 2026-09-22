import { useMemo } from 'react'
import type { Member } from '../../data/types'
import { useT } from '../../i18n'
import { fmtRelative } from '../../lib/format'
import { buildFeed, type SquadData } from '../../lib/stats'
import { Card, CardHeader, CardLink, EmptyState } from '../../ui'
import { FeedItemView } from '../squad/feed/FeedItemView'
import { HM } from './messages'

/**
 * The latest squad activity (workouts, weigh-ins, PRs, badges, plans) with kudos, for the coach's home.
 * `skip` leaves out the newest items when another card (the squad pulse) already shows them (and then the card
 * hides itself when there is nothing more to show).
 */
export function LatestCard(p: { data: SquadData; me: Member; now: number; limit?: number; skip?: number }) {
  const { data, me, now, limit = 5, skip = 0 } = p
  const t = useT(HM)
  const items = useMemo(() => buildFeed(data, { limit: skip + limit }).slice(skip), [data, limit, skip])
  // With `skip`, the card above already tells the "nothing yet" story.
  if (!items.length && skip > 0) return null
  return (
    <Card as="section" className="home-latest" aria-labelledby="home-latest-t">
      <CardHeader title={<span id="home-latest-t">{t('latestTitle')}</span>} action={<CardLink to="/squad?tab=feed">{t('seeAll')}</CardLink>} />
      {items.length ? (
        <div className="home-latest__list">
          {items.map((it) => (
            <FeedItemView key={it.id} item={it} members={data.members} me={me} unit={me.settings.unit} compact timeLabel={fmtRelative(Math.min(it.at, now), now)} />
          ))}
        </div>
      ) : (
        <EmptyState compact icon="sparkles" title={t('latestEmptyTitle')} body={t('latestEmptyBody')} />
      )}
    </Card>
  )
}
