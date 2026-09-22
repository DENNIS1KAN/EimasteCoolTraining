import { useMemo } from 'react'
import { Link } from 'react-router'
import type { Member, Unit } from '../../../data/types'
import { useT } from '../../../i18n'
import { fmtDate, fmtNum, fmtPct, fmtRelative } from '../../../lib/format'
import { logsOf, type MemberStats, type SquadData } from '../../../lib/stats'
import type { ISODate } from '../../../lib/dates'
import { Avatar, Icon, Tag, WeekDots, memberColorVar } from '../../../ui'
import { NudgeButton } from '../NudgeButton'
import { WeightSummary } from '../components/WeightSummary'
import { memberHref } from '../format'
import { lastActiveAt, programWeekDots } from '../logic/weekDots'
import type { WeightAccess } from '../logic/visibility'
import { SQ } from '../messages'

export interface CompetitorCardProps {
  member: Member
  stats: MemberStats
  data: SquadData
  today: ISODate
  now: number
  isMe: boolean
  access: WeightAccess
  unit: Unit
  isMvp?: boolean
}

/** One athlete's week at a glance; the whole card opens their profile. */
export function CompetitorCard({ member, stats, data, today, now, isMe, access, unit, isMvp }: CompetitorCardProps) {
  const t = useT(SQ)
  const program = stats.program
  const dots = useMemo(
    () => (program ? programWeekDots(program, member.programStart, logsOf(data, member.id), today) : []),
    [program, member.programStart, member.id, data, today],
  )
  const lastActive = useMemo(() => lastActiveAt(data, member.id), [data, member.id])
  const started = stats.programWeek > 0
  const doneDots = dots.filter((d) => d.state === 'done').length

  let progress: string
  if (!program) progress = t('noProgram')
  else if (!member.programStart) progress = t('notStarted')
  else if (!started) progress = t('startsOn', { date: fmtDate(member.programStart) })
  else progress = `${t('weekShort', { n: stats.programWeek })} · ${stats.workoutsDone}/${stats.workoutsTotal}`

  return (
    <article className={`ui-card sq-comp${isMe ? ' is-me' : ''}`} style={{ ['--c' as string]: memberColorVar(member.color) }}>
      <div className="sq-comp__head">
        <Avatar member={member} size={54} you={isMe} decorative />
        <div className="sq-comp__id">
          <h3 className="sq-comp__name">
            <Link to={memberHref(member)} className="sq-stretch" aria-label={t('openProfile', { name: member.name })}>
              {member.name}
            </Link>
            {isMe && <Tag tone="accent">{t('youLabel')}</Tag>}
            {isMvp && (
              <span className="sq-crown" title={t('mvpEyebrow')}>
                <Icon name="crown" size={16} title={t('mvpEyebrow')} />
              </span>
            )}
          </h3>
          {member.goal ? <p className="sq-comp__goal">{member.goal}</p> : null}
          <p className="sq-comp__prog">{progress}</p>
        </div>
        <Icon name="chevron-right" size={18} className="sq-comp__chev" />
      </div>

      {dots.length > 0 && (
        <div className="sq-comp__week">
          <WeekDots
            items={dots.map((d) => ({ label: d.label, state: d.state, title: d.name }))}
            size={26}
            label={t('weekDotsLabel', { n: dots[0].week, done: doneDots, total: dots.length })}
          />
          <p className="sq-comp__wk">
            <span className="num">
              {stats.thisWeek.done}
              <span className="sq-slash">/</span>
              {stats.thisWeek.target}
            </span>
            <span className="sq-comp__wk-l">{t('thisWeek')}</span>
          </p>
        </div>
      )}

      <dl className="sq-comp__stats">
        <div>
          <dt>{t('tileStreak')}</dt>
          <dd className="num">
            {fmtNum(stats.weekStreak, 0)}
            <small>{t('wkUnit')}</small>
          </dd>
        </div>
        <div>
          <dt>{t('tileOnSchedule')}</dt>
          <dd className="num">{stats.schedule?.consistency != null ? fmtPct(stats.schedule.consistency) : '—'}</dd>
        </div>
        <div>
          <dt>{t('weight')}</dt>
          <dd>
            <WeightSummary member={member} weight={stats.weight} access={access} unit={unit} showValue={false} />
          </dd>
        </div>
      </dl>

      <div className="sq-comp__foot">
        <span className="sq-comp__seen">
          <Icon name="clock" size={14} />
          <span className="visually-hidden">{t('lastActive')}: </span>
          {lastActive ? fmtRelative(lastActive, now) : t('noActivity')}
        </span>
        {!isMe && (
          <span className="sq-above">
            <NudgeButton member={member} size="sm" />
          </span>
        )}
      </div>
    </article>
  )
}
