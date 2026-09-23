import { useMemo } from 'react'
import { Link } from 'react-router'
import { useMe, useStore } from '../../data/store'
import { useT } from '../../i18n'
import { buildFeed } from '../../lib/stats'
import { Card, Icon, Tag } from '../../ui'
import { Composer } from '../squad/chat/Composer'
import { FeedItemView } from '../squad/chat/FeedItemView'
import { unreadPosts } from '../squad/chat/unread'
import { useStreamData } from '../squad/hooks'
import { SQ } from '../squad/messages'

const SHOWN = 3

/**
 * The squad chat on Home: the last few things that happened or were said, and a box to answer from without
 * leaving the page. The composer is the same component the Chat tab uses, so there is one send path.
 */
export function SquadChatCard() {
  const t = useT(SQ)
  const me = useMe()
  const data = useStreamData()
  const posts = useStore((s) => s.posts)
  const items = useMemo(() => buildFeed(data).slice(0, SHOWN), [data])
  const unread = unreadPosts(posts, me)
  const unit = me?.settings.unit ?? 'kg'

  return (
    <Card as="section" className="home-chat" aria-label={t('tabChat')}>
      <div className="home-chat__head">
        <h2 className="sub">{t('tabChat')}</h2>
        {unread > 0 ? <Tag tone="accent">{t('unreadN', { n: unread })}</Tag> : null}
        <Link to="/squad?tab=chat" className="home-chat__all" aria-label={t('openChat')}>
          {t('seeAll')}
          <Icon name="chevron-right" size={15} />
        </Link>
      </div>
      {items.length ? (
        // Not a link: feed items carry their own links (the author, the workout), and anchors cannot nest.
        // "See all" in the header is the way through to the full history.
        <div className="home-chat__list">
          {items.map((it) => (
            <FeedItemView key={it.id} item={it} members={data.members} me={me} unit={unit} compact />
          ))}
        </div>
      ) : (
        <p className="home-chat__empty">{t('chatEmptyBody')}</p>
      )}
      <Composer compact />
    </Card>
  )
}
