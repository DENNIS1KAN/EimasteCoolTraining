import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { useT } from '../../i18n'
import { fmtNum, fmtPct, fmtSigned } from '../../lib/format'
import { earnedBadges, logsOf, points } from '../../lib/stats'
import { Avatar, ButtonLink, Card, CardHeader, EmptyState, Icon, PageHeader, StatTile } from '../../ui'
import { WeightTrendChart } from '../body/WeightTrendChart'
import { useStore } from '../../data/store'
import { memberBySlug, useAllTimePoints, useSquad } from './hooks'
import { BadgesGrid } from './member/BadgesGrid'
import { ProfileHeader } from './member/ProfileHeader'
import { RecentWorkouts } from './member/RecentWorkouts'
import { TopLifts } from './member/TopLifts'
import { memberHref } from './format'
import { recentWorkouts, topLifts } from './logic/lifts'
import { rivalOf } from './logic/pair'
import { weightAccess } from './logic/visibility'
import { SQ } from './messages'
import './squad.css'

/** A member's profile (/member/:slug): header, stat tiles, weight, top lifts, recent workouts and badges. */
export default function MemberPage() {
  const t = useT(SQ)
  const { slug } = useParams()
  const { me, data, stats, competitors } = useSquad()
  const cheers = useStore((st) => st.cheers)
  const member = memberBySlug(data.members, slug)
  const allTime = useAllTimePoints(data, competitors)
  const unit = me?.settings.unit ?? 'kg'

  const logs = useMemo(() => (member ? logsOf(data, member.id) : []), [data, member])
  const lifts = useMemo(() => topLifts(logs, data.programs, 6), [logs, data.programs])
  const recent = useMemo(() => recentWorkouts(logs, 5), [logs])
  const badges = useMemo(() => (member ? earnedBadges({ ...data, cheers }, member.id) : []), [data, cheers, member])
  const totalPoints = useMemo(() => (member ? points(data, member.id).total : 0), [data, member])

  if (!member) {
    return (
      <div className="stack sq-page">
        <PageHeader back="/squad" title={t('profile')} />
        <EmptyState
          icon="user"
          title={t('memberNotFound')}
          body={t('memberNotFoundBody')}
          action={
            <ButtonLink to="/squad" variant="secondary">
              {t('backToSquad')}
            </ButtonLink>
          }
        />
      </div>
    )
  }

  const s = stats[member.id]
  const isMe = member.id === me?.id
  const access = weightAccess(member, me)
  // Compare: you vs them when you both compete; from your own profile, you vs your rival.
  const meCompetes = !!me && competitors.some((m) => m.id === me.id)
  const compareWith = !member.competes ? null : isMe ? rivalOf(competitors, me, allTime) : meCompetes ? me : (competitors.find((m) => m.id !== member.id) ?? null)

  if (member.role === 'coach' && !member.competes) {
    return (
      <div className="stack sq-page">
        <PageHeader back="/squad" eyebrow={t('coachRole')} title={member.name} />
        <ProfileHeader member={member} stats={s} isMe={isMe} compareWith={null} viewerFirst={false} />
        <Card as="section" aria-labelledby="sq-coaching-h">
          <CardHeader title={<span id="sq-coaching-h">{t('coachingN', { n: competitors.length })}</span>} subtitle={isMe ? undefined : t('coachProfileBody')} />
          <ul className="sq-athletes">
            {competitors.map((m) => (
              <li key={m.id}>
                <Link to={memberHref(m)} className="sq-athlete">
                  <Avatar member={m} size={40} you={m.id === me?.id} decorative />
                  <span className="sq-athlete__name">{m.name}</span>
                  <span className="sq-athlete__meta">{m.goal}</span>
                  <Icon name="chevron-right" size={16} className="sq-lift__chev" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    )
  }

  return (
    <div className="stack sq-page sq-member">
      <PageHeader back="/squad" eyebrow={member.role === 'coach' ? t('coachRole') : t('athleteRole')} title={member.name} />
      <div className="sq-member__grid">
        <div className="stack sq-member__main">
          <ProfileHeader member={member} stats={s} isMe={isMe} compareWith={compareWith} viewerFirst={meCompetes && !isMe} />
          <div className="grid-3 sq-tiles">
            <StatTile label={t('tileStreak')} value={fmtNum(s.weekStreak, 0)} unit={t('wkUnit')} icon="flame" />
            <StatTile label={t('tileOnSchedule')} value={s.schedule?.consistency != null ? fmtNum(s.schedule.consistency * 100, 0) : '—'} unit={s.schedule?.consistency != null ? '%' : undefined} icon="calendar-check" />
            <StatTile label={t('tileWorkouts')} value={fmtNum(s.workoutsDone, 0)} unit={s.workoutsTotal ? `/${s.workoutsTotal}` : undefined} icon="train" />
            <StatTile label={t('tilePrs')} value={fmtNum(s.prs.length, 0)} icon="trophy" />
            <StatTile label={t('tilePoints')} value={fmtNum(totalPoints, 0)} icon="star" />
            <StatTile
              label={t('tileStrength')}
              value={s.strengthGainPct != null ? fmtSigned(s.strengthGainPct * 100, 1) : '—'}
              unit={s.strengthGainPct != null ? '%' : undefined}
              icon="bolt"
            />
          </div>
          {access !== 'hidden' || isMe ? (
            <Card as="section" aria-labelledby="sq-weight-h">
              <CardHeader title={<span id="sq-weight-h">{t('weightChartTitle')}</span>} subtitle={s.goalProgress != null ? `${t('mGoal')}: ${fmtPct(Math.max(0, s.goalProgress))}` : undefined} />
              <WeightTrendChart memberId={member.id} days={90} height={200} />
            </Card>
          ) : null}
        </div>
        <div className="stack sq-member__side">
          <TopLifts member={member} lifts={lifts} unit={unit} isMe={isMe} />
          <RecentWorkouts member={member} logs={recent} programs={data.programs} prs={s.prs} unit={unit} isMe={isMe} />
        </div>
        <div className="sq-member__badges">
          <BadgesGrid earned={badges} ownerName={member.name} />
        </div>
      </div>
    </div>
  )
}
