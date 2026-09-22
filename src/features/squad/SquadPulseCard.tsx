import { useMemo, type JSX } from 'react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import { fmtNum, fmtRelative } from '../../lib/format'
import { buildFeed } from '../../lib/stats'
import { Avatar, Card, CardHeader, CardLink, EmptyState, memberColorVar } from '../../ui'
import { useAllTimePoints, useNow, useSquad, useSquadDataWithCheers } from './hooks'
import { useHeadToHead, useScoreLine } from './components/score'
import { FeedItemView } from './feed/FeedItemView'
import { compareHref, memberHref } from './format'
import { standings } from './logic/league'
import { defaultPair } from './logic/pair'
import { SQ } from './messages'
import './squad.css'

/** Home card: the head-to-head score, this week's mini leaderboard and the latest two things that happened. */
export function SquadPulseCard(): JSX.Element {
  const t = useT(SQ)
  const { me, today, data, stats, competitors } = useSquad()
  const withCheers = useSquadDataWithCheers()
  const now = useNow()
  const allTime = useAllTimePoints(data, competitors)
  const pair = defaultPair(competitors, me, allTime)
  const h2h = useHeadToHead(stats, pair?.[0] ?? null, pair?.[1] ?? null)
  const scoreLine = useScoreLine()
  const board = useMemo(() => standings(data, competitors.map((m) => m.id), 'week', today), [data, competitors, today])
  const latest = useMemo(() => buildFeed(withCheers, { limit: 2 }), [withCheers])
  const unit = me?.settings.unit ?? 'kg'

  return (
    <Card as="section" className="sq-pulse" aria-labelledby="sq-pulse-h">
      <CardHeader
        title={<span id="sq-pulse-h">{t('pulseTitle')}</span>}
        action={pair && h2h ? <CardLink to={compareHref(pair[0], pair[1])}>{scoreLine(h2h, pair[0], pair[1], me?.id)}</CardLink> : <CardLink to="/squad">{t('openSquad')}</CardLink>}
      />
      {board.length > 0 && (
        <ol className="sq-pulse__board" aria-label={t('pulseBoard')}>
          {board.map((r) => {
            const m = data.members[r.memberId]
            const s = stats[r.memberId]
            if (!m || !s) return null
            const isMe = m.id === me?.id
            const pct = s.thisWeek.target ? Math.min(1, s.thisWeek.done / s.thisWeek.target) : 0
            return (
              <li key={m.id} className={`sq-pulse__row${isMe ? ' is-me' : ''}`}>
                <Link
                  to={memberHref(m)}
                  className="sq-pulse__link"
                  aria-label={t('pulseRow', { rank: r.rank, name: m.name, done: s.thisWeek.done, target: s.thisWeek.target, points: r.points.total })}
                >
                  <span className="sq-pulse__rank num" aria-hidden="true">
                    {r.rank}
                  </span>
                  <Avatar member={m} size={32} you={isMe} decorative />
                  <span className="sq-pulse__name" aria-hidden="true">
                    <span className="truncate">{isMe ? t('you') : m.name}</span>
                    <span className="sq-pulse__bar">
                      <i style={{ width: `${pct * 100}%`, background: memberColorVar(m.color) }} />
                    </span>
                  </span>
                  <span className="sq-pulse__wk num" aria-hidden="true">
                    {s.thisWeek.done}
                    <span className="sq-slash">/</span>
                    {s.thisWeek.target}
                  </span>
                  <span className="sq-pulse__pts" aria-hidden="true">
                    <span className="num">{fmtNum(r.points.total, 0)}</span>
                    <small>{t('pts')}</small>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
      {latest.length ? (
        <div className="sq-pulse__feed">
          {latest.map((it) => (
            <FeedItemView key={it.id} item={it} members={data.members} me={me} unit={unit} compact timeLabel={fmtRelative(it.at, now)} />
          ))}
        </div>
      ) : (
        <EmptyState compact icon="users" title={t('pulseEmpty')} />
      )}
    </Card>
  )
}
