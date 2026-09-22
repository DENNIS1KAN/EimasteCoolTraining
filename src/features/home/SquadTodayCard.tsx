import { useMemo } from 'react'
import { Link } from 'react-router'
import { useT, type Vars } from '../../i18n'
import { fromISODate, type ISODate } from '../../lib/dates'
import { fmtDate, fmtDayLabel } from '../../lib/format'
import type { SquadData } from '../../lib/stats'
import { Avatar, ButtonLink, Card, CardHeader, CardLink, EmptyState, Icon, LiveDot, Tag, cx, type IconName } from '../../ui'
import { NudgeButton } from '../squad/NudgeButton'
import { fmtTimeOfDay } from './format'
import { foodVerdict, squadToday, summarize, type SquadTodayRow, type TodayStatus } from './logic/squadToday'
import { HM } from './messages'

type T = (k: keyof typeof HM.en, vars?: Vars) => string

/** Coach home: who trained today, who is behind, who skipped the scale, and everyone's latest food check-in. */
export function SquadTodayCard({ data, today, meId }: { data: SquadData; today: ISODate; meId: string }) {
  const t = useT(HM)
  const rows = useMemo(() => squadToday(data, today).filter((r) => r.member.id !== meId), [data, today, meId])
  const sum = summarize(rows)
  // Before anyone has a running program the strip would be all zeros: the set-up checklist covers that phase.
  const running = rows.some((r) => !['noStart', 'noProgram', 'startsOn'].includes(r.status.kind))

  return (
    <Card as="section" className="home-sq" aria-labelledby="home-sq-t">
      <CardHeader title={<span id="home-sq-t">{t('todayTitle')}</span>} action={<CardLink to="/coach">{t('console')}</CardLink>} />
      {rows.length === 0 ? (
        <EmptyState
          compact
          icon="users"
          title={t('noAthletesTitle')}
          body={t('noAthletesBody')}
          action={
            <ButtonLink to="/coach" size="sm" icon="user-plus">
              {t('addAthletes')}
            </ButtonLink>
          }
        />
      ) : (
        <>
          {running ? (
            <dl className="home-sq__strip">
              <div>
                <dt className="micro">{t('trainedToday')}</dt>
                <dd className="num">
                  {sum.trainedToday}
                  {sum.scheduledToday > 0 ? <span className="home-sq__of">/{sum.scheduledToday}</span> : null}
                </dd>
              </div>
              <div className={cx(sum.behind > 0 && 'is-warn')}>
                <dt className="micro">{t('behindLabel')}</dt>
                <dd className="num">{sum.behind}</dd>
              </div>
              <div className={cx(sum.staleWeighIns > 0 && 'is-warn')}>
                <dt className="micro">{t('weighInsLabel')}</dt>
                <dd className="num">{sum.staleWeighIns}</dd>
              </div>
            </dl>
          ) : null}
          <ul className="home-sq__list">
            {rows.map((r) => (
              <Row key={r.member.id} row={r} today={today} t={t} />
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

function Row({ row, today, t }: { row: SquadTodayRow; today: ISODate; t: T }) {
  const m = row.member
  const food = foodText(row, today, t)
  const weigh =
    row.daysSinceWeighIn == null ? t('weighNever') : row.daysSinceWeighIn === 0 ? t('weighToday') : t('weighDays', { n: row.daysSinceWeighIn })
  return (
    <li className={cx('home-sq__row', row.push && 'is-push')}>
      <Link to={`/member/${encodeURIComponent(m.slug)}`} className="home-sq__who">
        <Avatar member={m} size={40} decorative />
        <span className="home-sq__text">
          <span className="home-sq__name">
            <span className="truncate">{m.name}</span>
            {row.behindBy > 0 ? (
              <Tag tone="warn" icon="alert">
                {row.behindBy === 1 ? t('behindOne') : t('behindN', { n: row.behindBy })}
              </Tag>
            ) : null}
          </span>
          <Status status={row.status} t={t} />
          <span className="home-sq__meta">
            <span className={cx('home-sq__fact', food.tone && `is-${food.tone}`)}>
              <Icon name="fuel" size={14} />
              <span className="visually-hidden">{t('foodSr')} </span>
              {food.text}
            </span>
            {row.daysSinceWeighIn != null || row.staleWeighIn ? (
              <span className={cx('home-sq__fact', row.staleWeighIn && 'is-warn')}>
                <Icon name={row.staleWeighIn ? 'alert' : 'scale'} size={14} />
                {weigh}
              </span>
            ) : null}
          </span>
        </span>
      </Link>
      {row.push ? (
        <div className="home-sq__act">
          <NudgeButton member={m} size="sm" />
        </div>
      ) : null}
    </li>
  )
}

const STATUS_ICON: Record<TodayStatus['kind'], IconName | null> = {
  done: 'check-circle',
  training: null,
  due: 'clock',
  rest: 'moon',
  startsOn: 'calendar',
  noStart: 'calendar',
  noProgram: 'info',
  finished: 'trophy',
}

function Status({ status: s, t }: { status: TodayStatus; t: T }) {
  const text =
    s.kind === 'done'
      ? t('stDone', { day: s.dayName, time: fmtTimeOfDay(s.at) })
      : s.kind === 'training'
        ? t('stTraining', { day: s.dayName })
        : s.kind === 'due'
          ? t('stDue', { day: s.dayName })
          : s.kind === 'rest'
            ? t('stRest')
            : s.kind === 'startsOn'
              ? t('stStartsOn', { date: fmtDate(s.date) })
              : s.kind === 'noStart'
                ? t('stNoStart')
                : s.kind === 'noProgram'
                  ? t('stNoProgram')
                  : t('stFinished')
  const icon = STATUS_ICON[s.kind]
  return (
    <span className={cx('home-sq__status', `is-${s.kind}`)}>
      {icon ? <Icon name={icon} size={15} /> : <LiveDot pulse />}
      <span className="truncate">{text}</span>
    </span>
  )
}

function foodText(r: SquadTodayRow, today: ISODate, t: T): { text: string; tone: 'good' | 'warn' | null } {
  const v = foodVerdict(r, today)
  const c = r.lastCheckin
  if (!c || v === 'none' || v === 'noPlan') return { text: v === 'noPlan' ? t('foodNoPlan') : t('foodNone'), tone: null }
  const meals = c.mealsTotal > 0 && c.meals > 0 ? t('foodMeals', { n: c.meals, total: c.mealsTotal }) : null
  const day = fmtDayLabel(c.date, fromISODate(today))
  if (v === 'soFar') return { text: [meals ?? t('foodCheckedIn'), day].join(' · '), tone: null }
  const verdict = v === 'on' ? t('foodOn') : v === 'mostly' ? t('foodMostly') : t('foodOff')
  return { text: [verdict, meals, day].filter(Boolean).join(' · '), tone: v === 'on' ? 'good' : v === 'off' ? 'warn' : null }
}
