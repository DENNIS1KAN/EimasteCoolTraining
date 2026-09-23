import { useMemo } from 'react'
import type { Member } from '../../../data/types'
import { useT } from '../../../i18n'
import { fmtRelative } from '../../../lib/format'
import { buildFeed } from '../../../lib/stats'
import { Card, CardHeader, CardLink } from '../../../ui'
import { FeedItemView } from '../chat/FeedItemView'
import { useSquadDataWithCheers } from '../hooks'
import { SQ } from '../messages'

/** The last few things that happened, with a link to the full feed. Renders nothing while the feed is empty. */
export function LatestCard({ me, now, limit = 3 }: { me: Member | null; now: number; limit?: number }) {
  const t = useT(SQ)
  const data = useSquadDataWithCheers()
  const items = useMemo(() => buildFeed(data, { limit }), [data, limit])
  if (!items.length) return null
  return (
    <Card as="section" className="sq-latest" aria-labelledby="sq-latest-h">
      <CardHeader title={<span id="sq-latest-h">{t('latest')}</span>} action={<CardLink to="/squad?tab=feed">{t('seeAll')}</CardLink>} />
      <div className="sq-latest__list">
        {items.map((it) => (
          <FeedItemView key={it.id} item={it} members={data.members} me={me} unit={me?.settings.unit ?? 'kg'} compact timeLabel={fmtRelative(it.at, now)} />
        ))}
      </div>
    </Card>
  )
}
