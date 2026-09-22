import { Link } from 'react-router'
import type { Member, Program, Unit, WorkoutLog } from '../../../data/types'
import { dayShortName } from '../../../data/programs'
import { useT } from '../../../i18n'
import { fmtDayLabel, fmtDuration, fmtVolume } from '../../../lib/format'
import { logDate, sessionSummary, type PR } from '../../../lib/stats'
import { ButtonLink, Card, CardHeader, EmptyState, Icon, PRBadge } from '../../../ui'
import { NudgeButton } from '../NudgeButton'
import { memberWorkoutHref } from '../format'
import { SQ } from '../messages'

export interface RecentWorkoutsProps {
  member: Member
  logs: WorkoutLog[]
  programs: Record<string, Program>
  prs: PR[]
  unit: Unit
  isMe: boolean
}

/** The last finished workouts, each opening the read-only workout view. */
export function RecentWorkouts({ member, logs, programs, prs, unit, isMe }: RecentWorkoutsProps) {
  const t = useT(SQ)
  return (
    <Card as="section" className="sq-recent" aria-labelledby="sq-recent-h">
      <CardHeader title={<span id="sq-recent-h">{t('recentWorkouts')}</span>} />
      {logs.length ? (
        <ol className="sq-recent__list">
          {logs.map((l) => {
            const p = programs[l.programId]
            const day = p?.weeks[l.week - 1]?.days[l.day]
            const s = sessionSummary(l, p)
            const n = prs.filter((x) => x.logId === l.id).length
            const meta = [t('weekShort', { n: l.week }), t('setsN', { n: s.setsDone }), s.volumeKg > 0 ? fmtVolume(s.volumeKg, unit) : null, s.durationMs ? fmtDuration(s.durationMs) : null]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={l.id}>
                <Link to={memberWorkoutHref(member, l.week, l.day)} className="sq-recent__row">
                  <span className="sq-recent__day num">{day ? dayShortName(day) : '—'}</span>
                  <span className="sq-recent__main">
                    <span className="sq-recent__date">{fmtDayLabel(logDate(l))}</span>
                    <span className="sq-recent__meta">{meta}</span>
                  </span>
                  {n > 0 ? <PRBadge label={n > 1 ? `${n} PR` : 'PR'} /> : null}
                  <Icon name="chevron-right" size={16} className="sq-lift__chev" />
                </Link>
              </li>
            )
          })}
        </ol>
      ) : (
        <EmptyState
          compact
          icon="train"
          title={t('noWorkoutsTitle')}
          body={isMe ? t('noWorkoutsSelf') : t('noWorkoutsOther', { name: member.name })}
          action={
            isMe ? (
              <ButtonLink to="/train" size="sm" icon="play">
                {t('startWorkout')}
              </ButtonLink>
            ) : (
              <NudgeButton member={member} size="sm" />
            )
          }
        />
      )}
    </Card>
  )
}
