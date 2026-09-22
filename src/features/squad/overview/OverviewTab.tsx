import { useMemo } from 'react'
import { useT } from '../../../i18n'
import { EmptyState, SectionTitle } from '../../../ui'
import { sortedMembers } from '../../../lib/stats'
import { useAllTimePoints, useNow, useSquad } from '../hooks'
import { useHeadToHead } from '../components/score'
import { mvps as mvpIds, standings } from '../logic/league'
import { defaultPair } from '../logic/pair'
import { weightAccess } from '../logic/visibility'
import { SQ } from '../messages'
import { CoachRow } from './CoachRow'
import { CompetitorCard } from './CompetitorCard'
import { H2HCard } from './H2HCard'
import { KickoffCard } from './KickoffCard'
import { LatestCard } from './LatestCard'
import { MvpBanner } from './MvpBanner'

export function OverviewTab() {
  const t = useT(SQ)
  const { me, today, data, stats, competitors } = useSquad()
  const now = useNow()
  const unit = me?.settings.unit ?? 'kg'
  const allTime = useAllTimePoints(data, competitors)
  const week = useMemo(() => standings(data, competitors.map((m) => m.id), 'week', today), [data, competitors, today])
  const crown = mvpIds(week)
  const pair = defaultPair(competitors, me, allTime)
  const h2h = useHeadToHead(stats, pair?.[0] ?? null, pair?.[1] ?? null)
  // Outside the league: the coach, and any athlete who doesn't compete (CoachRow tags them differently).
  const sideline = useMemo(() => sortedMembers(data).filter((m) => !m.competes), [data])
  const anyActivity = useMemo(() => Object.values(data.logs).some((l) => l.done), [data.logs])

  const ordered = useMemo(() => {
    const rank = new Map(week.map((r, i) => [r.memberId, i]))
    return [...competitors].sort((x, y) => {
      if (me && x.id === me.id) return -1
      if (me && y.id === me.id) return 1
      return (rank.get(x.id) ?? 0) - (rank.get(y.id) ?? 0)
    })
  }, [competitors, week, me])

  if (!competitors.length) {
    return (
      <div className="stack">
        <EmptyState icon="users" title={t('emptySquadTitle')} body={t('emptySquadBody')} />
        {sideline.map((c) => (
          <CoachRow key={c.id} member={c} isMe={c.id === me?.id} athletes={0} />
        ))}
      </div>
    )
  }

  const topPoints = week[0]?.points.total ?? 0
  const unstarted = competitors.filter((m) => !m.programStart)
  const kickoff = !!me && ((me.role === 'coach' && unstarted.length > 0) || (me.role === 'athlete' && !anyActivity))
  return (
    <div className="stack sq-overview">
      <div className="sq-overview__top">
        {kickoff && me ? (
          <KickoffCard viewer={me} unstarted={unstarted} />
        ) : (
          <MvpBanner mvps={crown.map((id) => data.members[id]).filter(Boolean)} points={topPoints} viewerId={me?.id ?? null} />
        )}
        {pair && h2h ? (
          <H2HCard a={pair[0]} b={pair[1]} h2h={h2h} viewerId={me?.id ?? null} />
        ) : (
          <EmptyState compact icon="swap" title={t('soloTitle')} body={t('soloBody')} className="ui-card" />
        )}
      </div>

      <SectionTitle title={t('thisWeek')} />
      <div className="sq-comp-grid">
        {ordered.map((m) => (
          <CompetitorCard
            key={m.id}
            member={m}
            stats={stats[m.id]}
            data={data}
            today={today}
            now={now}
            isMe={m.id === me?.id}
            access={weightAccess(m, me)}
            unit={unit}
            isMvp={crown.includes(m.id)}
          />
        ))}
      </div>
      {sideline.length > 0 && (
        <div className="sq-coach-list">
          {sideline.map((c) => (
            <CoachRow key={c.id} member={c} isMe={c.id === me?.id} athletes={competitors.length} />
          ))}
        </div>
      )}
      <LatestCard me={me} now={now} />
    </div>
  )
}
