import { Button, Card, CardHeader, EmptyState, Tag } from '../../../ui'
import { useT } from '../../../i18n'
import type { ISODate } from '../../../lib/dates'
import { addDays, startOfWeek } from '../../../lib/dates'
import { fmtDate, fmtPct } from '../../../lib/format'
import { glanceTotals, type AthleteGlance } from '../lib/glance'
import { M } from '../messages'
import { GlanceRow } from './GlanceRow'

export interface GlanceCardProps {
  rows: AthleteGlance[]
  today: ISODate
  meId: string | null
  onAdd: () => void
}

/** "Squad at a glance": this week's workouts vs target, weigh-ins and food, the ones needing a push on top. */
export function GlanceCard({ rows, today, meId, onAdd }: GlanceCardProps) {
  const t = useT(M)
  const totals = glanceTotals(rows)
  const weekStart = startOfWeek(today)
  const range = `${fmtDate(weekStart, 'dayMonth')} – ${fmtDate(addDays(weekStart, 6), 'dayMonth')}`
  const needPush = rows.filter((r) => r.flags.includes('behind') || r.flags.includes('noWeighIn') || r.flags.includes('lowFood')).length

  const badge =
    rows.length === 0 ? null : needPush > 0 ? (
      <Tag tone="warn" icon="alert">
        {needPush === 1 ? t('needsAttentionOne') : t('needsAttention', { n: needPush })}
      </Tag>
    ) : (
      <Tag tone="good" icon="check">
        {t('onTrack')}
      </Tag>
    )

  return (
    <Card as="section" className="glance" aria-labelledby="coach-glance-title">
      <CardHeader title={<span id="coach-glance-title">{t('glanceTitle')}</span>} subtitle={t('glanceRange', { range })} action={badge} />
      {rows.length === 0 ? (
        <EmptyState
          compact
          icon="users"
          title={t('noAthletesTitle')}
          body={t('noAthletesBody')}
          action={
            <Button variant="primary" size="sm" icon="user-plus" onClick={onAdd}>
              {t('addMember')}
            </Button>
          }
        />
      ) : (
        <>
          <dl className="glance-strip">
            <div className="glance-strip__cell">
              <dt className="micro">{t('workoutsThisWeek')}</dt>
              <dd className="num glance-strip__value">
                {totals.weekDone}
                <span className="glance-strip__of">/{totals.weekTarget}</span>
              </dd>
            </div>
            <div className="glance-strip__cell">
              <dt className="micro">{t('onTrack')}</dt>
              <dd className="num glance-strip__value">
                {totals.onTrack}
                <span className="glance-strip__of">/{totals.athletes}</span>
              </dd>
            </div>
            <div className="glance-strip__cell">
              <dt className="micro">{t('foodOnPlan')}</dt>
              <dd className="num glance-strip__value">
                {totals.adherence == null ? <span className="glance-strip__of">–</span> : fmtPct(totals.adherence)}
              </dd>
            </div>
          </dl>
          {needPush === 0 ? <p className="glance__cheer">{t('allGood')}</p> : null}
          <ul className="glance__rows">
            {rows.map((r) => (
              <GlanceRow key={r.member.id} row={r} isMe={r.member.id === meId} />
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
