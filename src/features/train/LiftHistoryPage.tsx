import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { Member, Unit } from '../../data/types'
import { dayShortName } from '../../data/programs'
import { useMe, useStore } from '../../data/store'
import { useT } from '../../i18n'
import { fromISODate, isoFromMs } from '../../lib/dates'
import { fmtDate, fmtDayLabel, fmtNum, fmtPct } from '../../lib/format'
import { e1rm, exerciseHistory, personalRecords, type ExercisePoint } from '../../lib/stats'
import { kgToUnit } from '../../lib/units'
import { Avatar, BigNumber, ButtonLink, Card, CardHeader, Chip, Delta, EmptyState, Icon, PRBadge, PageHeader, memberColorVar } from '../../ui'
import { LineChart, type LineSeries } from '../../ui/charts'
import { setSeparator } from './logic/format'
import { LIFT } from './messages'
import './train.css'
import './lift.css'

/** /lift/:slug/:exercise: one exercise's history for a member, with an optional rival overlay. */
export default function LiftHistoryPage() {
  const t = useT(LIFT)
  const params = useParams()
  const me = useMe()
  const slug = params.slug ?? ''
  const name = params.exercise ?? ''
  const member = useStore((s) => Object.values(s.members).find((m) => m.slug === slug) ?? null)
  if (!me) return null
  if (!member || !name) {
    return (
      <div className="tr-page">
        <PageHeader back title={t('notFound')} />
        <Card>
          <EmptyState icon="search" title={t('notFound')} body={t('notFoundBody')} action={<ButtonLink to="/squad">{t('backSquad')}</ButtonLink>} />
        </Card>
      </div>
    )
  }
  return <LiftHistory me={me} member={member} name={name} />
}

interface SetE {
  kg: number
  reps: number
  e1: number
}

function LiftHistory({ me, member, name }: { me: Member; member: Member; name: string }) {
  const t = useT(LIFT)
  const unit: Unit = me.settings.unit
  const programs = useStore((s) => s.programs)
  const logs = useStore((s) => Object.values(s.logs).filter((l) => l.memberId === member.id))
  const history = useMemo(() => exerciseHistory(logs, programs, name), [logs, programs, name])
  const prLogIds = useMemo(() => new Set(personalRecords(logs, programs).filter((p) => p.exercise === name).map((p) => p.logId)), [logs, programs, name])
  const dayNames = useMemo(() => {
    const out: Record<string, string> = {}
    for (const l of logs) {
      const d = programs[l.programId]?.weeks[l.week - 1]?.days[l.day]
      out[l.id] = d ? dayShortName(d) : ''
    }
    return out
  }, [logs, programs])
  const isMe = me.id === member.id
  const u = (kg: number) => kgToUnit(kg, unit)

  const best = useMemo(() => {
    let top: (SetE & { at: number }) | null = null
    for (const p of history)
      for (const s of p.sets) {
        const e1 = s.kg ? e1rm(s.kg, s.reps) : 0
        if (s.kg && (!top || e1 > top.e1)) top = { kg: s.kg, reps: s.reps, e1, at: p.at }
      }
    return top
  }, [history])
  const first = history[0]?.bestE1rmKg ?? 0
  const bestE1 = history.reduce((a, p) => Math.max(a, p.bestE1rmKg), 0)
  const gain = first > 0 && history.length > 1 ? (bestE1 - first) / first : null

  return (
    <div className="tr-page lf-page">
      <PageHeader
        back
        eyebrow={t('eyebrow', { name: member.name })}
        title={<span lang="en">{name}</span>}
        actions={
          <Link to={`/member/${member.slug}`} className="lf-avatar" aria-label={member.name}>
            <Avatar member={member} size={40} you={isMe} decorative />
          </Link>
        }
      />
      {!history.length ? (
        <Card>
          <EmptyState
            icon="chart"
            title={t('empty')}
            body={isMe ? t('emptyMine', { exercise: name }) : t('emptyOther', { name: member.name, exercise: name })}
            action={isMe ? <ButtonLink to="/train" icon="play">{t('goTrain')}</ButtonLink> : undefined}
          />
        </Card>
      ) : (
        <div className="lf-grid">
          <div className="lf-col">
            <Card as="section" className="lf-hero" aria-label={t('bestE1rm')}>
              <div className="lf-hero__main">
                <p className="eyebrow">{t('bestE1rm')}</p>
                <BigNumber value={fmtNum(u(bestE1), 1)} unit={unit} size="xl" />
                {gain != null && Math.abs(gain) >= 0.005 ? (
                  <Delta text={t('gain', { pct: fmtPct(Math.abs(gain)) })} dir={gain > 0 ? 'up' : 'down'} tone={gain > 0 ? 'good' : 'warn'} />
                ) : null}
                <p className="lf-hint">{t('e1rmHint')}</p>
              </div>
              <dl className="lf-hero__stats">
                <div>
                  <dt>{t('bestSet')}</dt>
                  <dd className="num">
                    {best ? (
                      <>
                        {fmtNum(u(best.kg), 1)}
                        <i className="mul">×</i>
                        {best.reps}
                      </>
                    ) : (
                      '—'
                    )}
                  </dd>
                  {best ? <span className="lf-sub">{fmtDate(isoFromMs(best.at), 'medium')}</span> : null}
                </div>
                <div>
                  <dt>{t('sessions')}</dt>
                  <dd className="num">{history.length}</dd>
                  <span className="lf-sub">{fmtDate(history[0].date)} – {fmtDate(history[history.length - 1].date)}</span>
                </div>
              </dl>
            </Card>
            <ProgressChart member={member} me={me} name={name} history={history} unit={unit} />
          </div>
          <SessionList member={member} history={history} unit={unit} prLogIds={prLogIds} dayNames={dayNames} />
        </div>
      )}
    </div>
  )
}

function ProgressChart({ me, member, name, history, unit }: { me: Member; member: Member; name: string; history: ExercisePoint[]; unit: Unit }) {
  const t = useT(LIFT)
  const members = useStore((s) => s.members)
  const programs = useStore((s) => s.programs)
  const allLogs = useStore((s) => s.logs)
  const [rivalId, setRivalId] = useState<string | null>(null)

  // Everyone else who has performed this exercise (their full history, only computed for the chips once).
  const rivals = useMemo(() => {
    const out: { m: Member; pts: ExercisePoint[] }[] = []
    for (const m of Object.values(members)) {
      if (m.id === member.id) continue
      const pts = exerciseHistory(
        Object.values(allLogs).filter((l) => l.memberId === m.id),
        programs,
        name,
      )
      if (pts.length) out.push({ m, pts })
    }
    return out.sort((a, b) => (a.m.id === me.id ? -1 : b.m.id === me.id ? 1 : a.m.name.localeCompare(b.m.name)))
  }, [members, member.id, allLogs, programs, name, me.id])

  const toSeries = (m: Member, pts: ExercisePoint[], emphasis: boolean): LineSeries => ({
    id: m.id,
    label: m.name,
    color: memberColorVar(m.color),
    points: pts.map((p) => ({ x: fromISODate(p.date).getTime(), y: Math.round(kgToUnit(p.bestE1rmKg, unit) * 10) / 10 })),
    area: !rivalId && pts.length >= 3,
    emphasis,
    dots: 'end',
  })
  const rival = rivals.find((r) => r.m.id === rivalId) ?? null
  const series = [toSeries(member, history, false), ...(rival ? [toSeries(rival.m, rival.pts, false)] : [])]

  return (
    <Card as="section" className="lf-chart" aria-labelledby="lf-chart-title">
      <CardHeader title={<span id="lf-chart-title">{t('chartTitle')}</span>} subtitle={t('chartSub', { unit })} />
      <LineChart
        series={series}
        height={220}
        yPadding={0.1}
        formatY={(n) => fmtNum(n, 0)}
        formatTooltipY={(n) => `${fmtNum(n, 1)} ${unit}`}
        formatX={(x) => fmtDate(isoFromMs(x))}
        ariaLabel={t('chartAria', { exercise: name, names: series.map((s) => s.label).join(', ') })}
        table="hidden"
      />
      <div className="lf-compare">
        <p className="micro">{t('compare')}</p>
        {rivals.length ? (
          <div className="lf-compare__chips">
            {rivals.map(({ m }) => (
              <Chip
                key={m.id}
                selected={rivalId === m.id}
                onClick={() => setRivalId(rivalId === m.id ? null : m.id)}
                icon={<span className="lf-dot" style={{ background: memberColorVar(m.color) }} aria-hidden="true" />}
              >
                {m.name}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="lf-hint">{t('nobodyElse')}</p>
        )}
      </div>
    </Card>
  )
}

function SessionList(p: { member: Member; history: ExercisePoint[]; unit: Unit; prLogIds: Set<string>; dayNames: Record<string, string> }) {
  const { member, history, unit, prLogIds, dayNames } = p
  const t = useT(LIFT)
  const rows = [...history].reverse()
  return (
    <Card as="section" padding="none" className="lf-list" aria-labelledby="lf-list-title">
      <div className="lf-list__head">
        <CardHeader title={<span id="lf-list-title">{t('sessionList')}</span>} />
      </div>
      <ol>
        {rows.map((p) => {
          return (
            <li key={p.logId}>
              <Link to={`/member/${member.slug}/workout/${p.week}/${p.day}`} className="lf-row">
                <span className="lf-row__when">
                  <b>{fmtDayLabel(p.date)}</b>
                  <span>{t('weekDay', { week: p.week, day: dayNames[p.logId] ?? '' })}</span>
                </span>
                <span className="lf-row__sets num">
                  {p.sets.map((s, i) => (
                    <span key={i} className="nowrap">
                      {s.kg != null ? (
                        <>
                          {fmtNum(kgToUnit(s.kg, unit), 1)}
                          <i className="mul">×</i>
                        </>
                      ) : null}
                      {s.reps}
                      {i < p.sets.length - 1 ? setSeparator().trimEnd() : null}
                    </span>
                  ))}
                  {p.machine ? (
                    <span className="lf-row__machine">
                      <Icon name="machine" size={12} /> {p.machine}
                    </span>
                  ) : null}
                </span>
                <span className="lf-row__end">
                  {prLogIds.has(p.logId) ? <PRBadge /> : null}
                  <span className="lf-row__e1" title={t('bestE1rm')}>
                    <b className="num">{fmtNum(kgToUnit(p.bestE1rmKg, unit), 1)}</b>
                    <small>e1RM</small>
                  </span>
                  <Icon name="chevron-right" size={16} className="lf-row__chev" />
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
