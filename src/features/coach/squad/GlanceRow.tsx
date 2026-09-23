import { Link } from 'react-router'
import { Avatar, ButtonLink, Icon, Tag } from '../../../ui'
import { useT } from '../../../i18n'
import { COMMON } from '../../../i18n/common'
import { fmtPct } from '../../../lib/format'
import { dayShortName } from '../../../data/programs'
import { cx } from '../../../ui'
import { LOW_ADHERENCE, type AthleteGlance } from '../lib/glance'
import { M } from '../messages'
import { WeekMeter } from './WeekMeter'
import { NudgeSlot } from './NudgeSlot'

/** One athlete in "Squad at a glance": status, this week's workouts, last weigh-in, food adherence, and a push. */
export function GlanceRow({ row, isMe }: { row: AthleteGlance; isMe: boolean }) {
  const t = useT(M)
  const tc = useT(COMMON)
  const { member: m, stats, flags } = row
  const behind = flags.includes('behind')
  const staleWeighIn = flags.includes('noWeighIn')
  const setup = flags.includes('noProgram') || flags.includes('notStarted')
  const lowFood = flags.includes('lowFood')
  const edit = `/coach/member/${m.slug}`

  const next = stats.nextWorkout && stats.program?.weeks[stats.nextWorkout.week - 1]?.days[stats.nextWorkout.day]
  // "Week 3/12 · Next: Lower": each part stays on one line, the line only breaks at the dot
  const meta = [
    stats.programWeek > 0 && stats.program ? `${tc('weekN', { n: stats.programWeek })}/${stats.program.weeks.length}` : null,
    next ? `${tc('next')}: ${dayShortName(next)}` : null,
  ]
    .filter((x): x is string => !!x)
    .map((x) => x.replace(/ /g, '\u00a0'))
    .join(' · ')

  let status
  if (flags.includes('noProgram')) status = <Tag tone="neutral">{t('noProgram')}</Tag>
  else if (flags.includes('notStarted')) status = <Tag tone="neutral">{t('notStarted')}</Tag>
  else if (behind) status = <Tag tone="warn" icon="alert">{t('behindN', { n: row.behindBy })}</Tag>
  else if (stats.schedule && stats.schedule.aheadBy > 0) status = <Tag tone="good" icon="bolt">{t('aheadN', { n: stats.schedule.aheadBy })}</Tag>
  else status = <Tag tone="good" icon="check">{t('onTrack')}</Tag>

  let action = null
  if (flags.includes('noProgram')) action = <ButtonLink to={edit} size="sm" variant="tonal">{t('assignProgram')}</ButtonLink>
  else if (flags.includes('notStarted')) action = <ButtonLink to={edit} size="sm" variant="tonal" icon="calendar">{t('setStart')}</ButtonLink>
  else if (!isMe && (behind || staleWeighIn || lowFood)) action = <NudgeSlot member={m} />

  const weighIn =
    row.daysSinceWeighIn == null ? t('noWeighIn') : row.daysSinceWeighIn === 0 ? t('weighedToday') : t('weighedDaysAgo', { n: row.daysSinceWeighIn })

  return (
    <li className={cx('glance-row', behind && 'is-behind')}>
      <div className="glance-row__head">
        <Avatar member={m} size={40} decorative />
        <div className="glance-row__who">
          <p className="glance-row__name">
            <Link to={edit} className="glance-row__link">
              {m.name}
            </Link>
          </p>
          <p className="glance-row__meta">
            {status}
            {meta ? <span>{meta}</span> : null}
          </p>
        </div>
        {action ? <div className="glance-row__action">{action}</div> : null}
      </div>
      <dl className="glance-row__metrics">
        <div className="glance-metric">
          <dt className="micro">{t('colWorkouts')}</dt>
          <dd>
            {row.weekTarget > 0 || row.weekDone > 0 ? (
              <>
                <span className="num glance-metric__value">
                  {row.weekDone}
                  <span className="glance-metric__of">/{row.weekTarget}</span>
                </span>
                <WeekMeter done={row.weekDone} target={row.weekTarget} due={row.weekDueSoFar} label={t('weekProgress', { done: row.weekDone, target: row.weekTarget })} />
              </>
            ) : (
              <span className="glance-metric__text is-muted">–</span>
            )}
          </dd>
        </div>
        <div className={cx('glance-metric', 'glance-metric--text', staleWeighIn && 'is-warn')}>
          <dt className="micro">{t('colWeighIn')}</dt>
          <dd>
            {staleWeighIn ? <Icon name="alert" size={14} strokeWidth={2.2} /> : <Icon name="scale" size={14} />}
            <span className={cx('glance-metric__text', setup && row.daysSinceWeighIn == null && 'is-muted')}>{weighIn}</span>
            {staleWeighIn && row.daysSinceWeighIn != null ? (
              <span className="visually-hidden">{t('staleWeighIn', { n: row.daysSinceWeighIn })}</span>
            ) : null}
          </dd>
        </div>
        <div className={cx('glance-metric', lowFood && 'is-warn')}>
          <dt className="micro">{t('colFood')}</dt>
          <dd>
            {row.adherence == null ? (
              // A plan without a complete day yet is "new", not missing.
              <span className="glance-metric__text is-muted">{stats.mealPlan ? t('newPlan') : t('noPlan')}</span>
            ) : (
              <>
                {lowFood ? <Icon name="alert" size={14} strokeWidth={2.2} /> : null}
                <span className="num glance-metric__value">{fmtPct(row.adherence)}</span>
                <span className="glance-food" aria-hidden="true">
                  <span className="glance-food__fill" style={{ width: `${Math.min(1, row.adherence) * 100}%` }} />
                  <span className="glance-food__mark" style={{ left: `${LOW_ADHERENCE * 100}%` }} />
                </span>
              </>
            )}
          </dd>
        </div>
      </dl>
    </li>
  )
}
