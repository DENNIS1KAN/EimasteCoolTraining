import { useMemo, useState, type ReactNode } from 'react'
import type { Member, Unit } from '../../../data/types'
import { useT } from '../../../i18n'
import { fmtDate, fmtNum, fmtSigned } from '../../../lib/format'
import { isoFromMs, type ISODate } from '../../../lib/dates'
import { kgToUnit } from '../../../lib/units'
import { logsOf, weightSeries, weightsOf, type SquadData } from '../../../lib/stats'
import { Card, EmptyState, Segmented, Select, memberColorVar } from '../../../ui'
import { BarChart, LineChart } from '../../../ui/charts'
import { commonExercises, liftDuelPoints, raceSeries, raceStart, volumeWeeks, weeklyVolume, weightChangeSeries } from '../logic/compare'
import type { WeightAccess } from '../logic/visibility'
import { SQ } from '../messages'

const dayLabel = (x: number) => fmtDate(isoFromMs(x))

export function ChartCard({ title, sub, action, children, className }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card as="section" className={`sq-chart${className ? ` ${className}` : ''}`}>
      <div className="sq-chart__head">
        <div>
          <h2 className="sq-chart__title">{title}</h2>
          {sub ? <p className="sq-chart__sub">{sub}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}

interface Duo {
  a: Member
  b: Member
  data: SquadData
  today: ISODate
}

/** Cumulative finished workouts per day since the earlier program start. */
export function RaceChart({ a, b, data, today }: Duo) {
  const t = useT(SQ)
  const { series, last } = useMemo(() => {
    const la = logsOf(data, a.id)
    const lb = logsOf(data, b.id)
    const from = raceStart([a.programStart, b.programStart], [...la, ...lb], today)
    if (!from) return { series: [], last: [0, 0] }
    const pa = raceSeries(la, from, today)
    const pb = raceSeries(lb, from, today)
    return {
      series: [
        { id: a.id, label: a.name, color: memberColorVar(a.color), points: pa, curve: 'step' as const },
        { id: b.id, label: b.name, color: memberColorVar(b.color), points: pb, curve: 'step' as const },
      ],
      last: [pa[pa.length - 1]?.y ?? 0, pb[pb.length - 1]?.y ?? 0],
    }
  }, [a, b, data, today])
  return (
    <ChartCard title={t('raceTitle')} sub={t('raceSub')}>
      {series.length && (last[0] > 0 || last[1] > 0) ? (
        <LineChart
          series={series}
          xType="time"
          height={190}
          zeroBaseline
          formatY={(n) => fmtNum(n, 0)}
          formatX={dayLabel}
          ariaLabel={t('raceAria', { a: a.name, va: last[0], b: b.name, vb: last[1] })}
        />
      ) : (
        <EmptyState compact icon="flame" title={t('raceEmpty')} />
      )}
    </ChartCard>
  )
}

const VOLUME_WEEKS = 6

/** Training volume per calendar week, side by side: the last 6 weeks, or fewer when the race started more recently. */
export function VolumeChart({ a, b, data, today, unit }: Duo & { unit: Unit }) {
  const t = useT(SQ)
  const { weeks, va, vb } = useMemo(() => {
    const la = logsOf(data, a.id)
    const lb = logsOf(data, b.id)
    const ws = volumeWeeks(today, raceStart([a.programStart, b.programStart], [...la, ...lb], today), VOLUME_WEEKS)
    const scale = (kg: number) => (unit === 'lb' ? kgToUnit(kg, 'lb') / 1000 : kg / 1000)
    return {
      weeks: ws,
      va: weeklyVolume(la, data.programs, ws).map(scale),
      vb: weeklyVolume(lb, data.programs, ws).map(scale),
    }
  }, [a.id, b.id, a.programStart, b.programStart, data, today, unit])
  const any = va.some((v) => v > 0) || vb.some((v) => v > 0)
  const u = unit === 'lb' ? 'k lb' : 't'
  const full = weeks.length >= VOLUME_WEEKS
  return (
    <ChartCard title={t('volumeTitle')} sub={t(full ? 'volumeSub' : 'volumeSubStart', { unit: u })}>
      {any ? (
        <BarChart
          categories={weeks.map((w) => fmtDate(w, 'short'))}
          categoryTitles={weeks.map((w) => fmtDate(w, 'medium'))}
          series={[
            { id: a.id, label: a.name, color: memberColorVar(a.color), values: va },
            { id: b.id, label: b.name, color: memberColorVar(b.color), values: vb },
          ]}
          height={190}
          formatY={(n) => fmtNum(n, 1)}
          formatTooltipY={(n) => `${fmtNum(n, 1)} ${u}`}
          ariaLabel={t(full ? 'volumeAria' : 'volumeAriaStart', { a: a.name, b: b.name })}
        />
      ) : (
        <EmptyState compact icon="dumbbell-plate" title={t('volumeEmpty')} />
      )}
    </ChartCard>
  )
}

/** Pick a lift both have done: best e1RM per session, absolute or relative to body weight. */
export function LiftDuel({ a, b, data, unit, accessA, accessB }: Duo & { unit: Unit; accessA: WeightAccess; accessB: WeightAccess }) {
  const t = useT(SQ)
  const la = useMemo(() => logsOf(data, a.id), [data, a.id])
  const lb = useMemo(() => logsOf(data, b.id), [data, b.id])
  const common = useMemo(() => commonExercises(la, lb, data.programs), [la, lb, data.programs])
  const [pick, setPick] = useState<string | null>(null)
  const exercise = pick && common.includes(pick) ? pick : (common[0] ?? null)
  const bwA = useMemo(() => weightSeries(weightsOf(data, a.id)), [data, a.id])
  const bwB = useMemo(() => weightSeries(weightsOf(data, b.id)), [data, b.id])
  const canRelative = accessA === 'exact' && accessB === 'exact' && bwA.length > 0 && bwB.length > 0
  const [mode, setMode] = useState<'abs' | 'rel'>('abs')
  const rel = canRelative && mode === 'rel'

  const series = useMemo(() => {
    if (!exercise) return []
    const conv = (pts: { x: number; y: number }[]) => (rel ? pts : pts.map((p) => ({ x: p.x, y: kgToUnit(p.y, unit) })))
    return [
      { id: a.id, label: a.name, color: memberColorVar(a.color), points: conv(liftDuelPoints(la, data.programs, exercise, rel ? bwA : undefined)), dots: 'all' as const },
      { id: b.id, label: b.name, color: memberColorVar(b.color), points: conv(liftDuelPoints(lb, data.programs, exercise, rel ? bwB : undefined)), dots: 'all' as const },
    ]
  }, [exercise, rel, a, b, la, lb, data.programs, bwA, bwB, unit])

  const fmtY = (n: number) => (rel ? `${fmtNum(n, 2)}×` : fmtNum(n, 0))
  return (
    <ChartCard
      title={t('duelTitle')}
      sub={t('duelSub')}
      className="sq-duel"
      action={
        canRelative && exercise ? (
          <Segmented
            size="sm"
            ariaLabel={t('duelModeLabel')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'abs', label: unit },
              { value: 'rel', label: '×BW', ariaLabel: t('duelRelative') },
            ]}
          />
        ) : undefined
      }
    >
      {exercise ? (
        <>
          <Select label={t('duelExercise')} value={exercise} onChange={(v) => setPick(v)} options={common.map((n) => ({ value: n, label: n }))} />
          <LineChart
            series={series}
            xType="time"
            height={200}
            yPadding={0.15}
            formatY={fmtY}
            formatTooltipY={(n) => (rel ? t('duelBw', { n: fmtNum(n, 2) }) : `${fmtNum(n, 1)} ${unit}`)}
            formatX={dayLabel}
            ariaLabel={t('duelAria', { exercise, a: a.name, b: b.name })}
          />
        </>
      ) : (
        <EmptyState compact icon="dumbbell-plate" title={t('duelEmpty')} />
      )}
    </ChartCard>
  )
}

/** Trend weight change (%) since each member's program start; members who keep their weight private are left out. */
export function WeightDuel({ a, b, data, accessA, accessB }: Duo & { accessA: WeightAccess; accessB: WeightAccess }) {
  const t = useT(SQ)
  const sides = [
    { m: a, access: accessA },
    { m: b, access: accessB },
  ]
  const series = useMemo(
    () =>
      sides
        .filter((s) => s.access !== 'hidden')
        .map((s) => ({
          id: s.m.id,
          label: s.m.name,
          color: memberColorVar(s.m.color),
          points: weightChangeSeries(weightsOf(data, s.m.id), s.m.programStart),
        }))
        .filter((s) => s.points.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a, b, accessA, accessB, data],
  )
  const hidden = sides.filter((s) => s.access === 'hidden')
  if (hidden.length === 2) return null
  return (
    <ChartCard title={t('weightTitle')} sub={t('weightSub')}>
      {series.length ? (
        <LineChart
          series={series}
          xType="time"
          height={190}
          yPadding={0.2}
          legend={series.length > 1}
          formatY={(n) => `${fmtSigned(n * 100, 1)}%`}
          formatX={dayLabel}
          ariaLabel={t('weightAria', { names: series.map((s) => s.label).join(', ') })}
        />
      ) : (
        <EmptyState compact icon="scale" title={t('weightEmpty')} />
      )}
      {hidden.map((s) => (
        <p key={s.m.id} className="sq-chart__note">
          {t('weightPrivateOne', { name: s.m.name })}
        </p>
      ))}
    </ChartCard>
  )
}
