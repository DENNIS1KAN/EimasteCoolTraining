import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Member } from '../../../data/types'
import { useT } from '../../../i18n'
import { fmtNum } from '../../../lib/format'
import { plural } from '../../../i18n'
import { POINTS } from '../../../lib/stats'
import { Avatar, Card, CardHeader, Icon, Tag, memberColorVar } from '../../../ui'
import { memberHref } from '../format'
import type { Standing } from '../logic/league'
import { SQ } from '../messages'

/** Points per item (from POINTS) and the count labels for the breakdown line. */
const PARTS = [
  ['workouts', POINTS.workout, 'cWorkout', 'cWorkouts'],
  ['prs', POINTS.pr, 'cPr', 'cPrs'],
  ['perfectWeeks', POINTS.perfectWeek, 'cPerfect', 'cPerfects'],
  ['weighIns', POINTS.weighIn, 'cWeighIn', 'cWeighIns'],
  ['onPlanDays', POINTS.onPlanDay, 'cOnPlan', 'cOnPlans'],
] as const

/** Ranked table: rank, member, a bar relative to the leader and the points breakdown. */
export function Standings({ rows, members, meId, action }: { rows: Standing[]; members: Record<string, Member>; meId: string | null; action?: ReactNode }) {
  const t = useT(SQ)
  const top = Math.max(1, rows[0]?.points.total ?? 0)
  return (
    <Card as="section" padding="none" className="sq-standings" aria-labelledby="sq-standings-h">
      <div className="sq-standings__head">
        <CardHeader title={<span id="sq-standings-h">{t('standings')}</span>} action={action} />
      </div>
      <ol className="sq-standings__list">
        {rows.map((r) => {
          const m = members[r.memberId]
          if (!m) return null
          const isMe = m.id === meId
          const parts = PARTS.filter(([k]) => r.points[k] > 0)
          const leader = r.rank === 1 && r.points.total > 0
          return (
            <li key={m.id} className={`sq-stand${isMe ? ' is-me' : ''}${leader ? ' is-leader' : ''}`}>
              <span className="sq-stand__rank num">
                <span aria-hidden="true">{leader ? <Icon name="crown" size={18} /> : r.rank}</span>
                <span className="visually-hidden">{t(leader ? 'rankLeader' : 'rankN', { n: r.rank })}</span>
              </span>
              <Avatar member={m} size={40} you={isMe} decorative />
              <div className="sq-stand__main">
                <p className="sq-stand__name">
                  <Link to={memberHref(m)} className="sq-stretch">
                    {m.name}
                  </Link>
                  {isMe && <Tag tone="accent">{t('youLabel')}</Tag>}
                </p>
                <div className="sq-stand__bar" aria-hidden="true">
                  <i style={{ width: `${(r.points.total / top) * 100}%`, background: memberColorVar(m.color) }} />
                </div>
                <p className="sq-stand__break">
                  {parts.length ? (
                    parts.map(([k, per, one, many]) => {
                      const n = Math.round(r.points[k] / per)
                      return <span key={k}>{plural(n, t(one, { n: fmtNum(n, 0) }), t(many, { n: fmtNum(n, 0) }))}</span>
                    })
                  ) : (
                    <span>{t('noPointsYet')}</span>
                  )}
                </p>
              </div>
              <p className="sq-stand__pts">
                <span className="num">{fmtNum(r.points.total, 0)}</span>
                <small>{t('pts')}</small>
              </p>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
