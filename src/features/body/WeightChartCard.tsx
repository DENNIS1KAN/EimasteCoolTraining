import { useMemo } from 'react'
import type { Member, Program } from '../../data/types'
import { useT } from '../../i18n'
import { fromISODate, isoFromMs } from '../../lib/dates'
import { fmtDate, fmtDayLabel, fmtNum } from '../../lib/format'
import { kgToUnit } from '../../lib/units'
import { Card, CardHeader, EmptyState, memberColorVar } from '../../ui'
import { Legend, LineChart, type ChartMarker, type LegendItem, type LineSeries, type RefLine } from '../../ui/charts'
import type { WeightModel } from './hooks'
import { clipSeries, goalFits, rangeFrom, toDisplay, type Range } from './logic'
import { M } from './messages'
import { wText } from './format'

const ms = (d: string) => fromISODate(d).getTime()

/** "BTS · 12 weeks" -> "BTS" */
const programShort = (p: Program | null | undefined) => (p ? p.name.split(' · ')[0].trim() : '')

/** Daily weigh-ins as faint dots under the smoothed trend line, with the goal and the program start. */
export function WeightChartCard({
  member,
  model,
  range,
  program,
  height = 188,
}: {
  member: Member
  model: WeightModel
  range: Range
  program: Program | null
  height?: number
}) {
  const t = useT(M)
  const unit = member.settings.unit
  const color = memberColorVar(member.color)
  const from = rangeFrom(range, model.today)

  const chart = useMemo(() => {
    const pts = clipSeries(model.series, from)
    if (pts.length < 1) return null
    const raw = pts.map((p) => ({ x: ms(p.date), y: toDisplay(p.kg, unit) }))
    // Unrounded: the formatters round once (to 0.1), exactly like the hero, so the end label and the stats agree.
    const trend = pts.map((p) => ({ x: ms(p.date), y: kgToUnit(p.trendKg, unit) }))
    const goal = member.goalWeightKg != null ? toDisplay(member.goalWeightKg, unit) : null
    const showGoal =
      goal != null &&
      goalFits(
        [...raw, ...trend].map((p) => p.y),
        goal,
        unit,
      )
    const start = member.programStart
    const markers: ChartMarker[] =
      start && program && start > pts[0].date && start <= model.today
        ? [{ x: ms(start), label: t('programStart', { program: programShort(program) }) }]
        : []
    const refLines: RefLine[] = showGoal ? [{ y: goal, label: t('goalLine', { value: fmtNum(goal, 1, 1) }) }] : []
    const series: LineSeries[] = [
      { id: 'daily', label: t('daily'), color, points: raw, line: false },
      { id: 'trend', label: t('trend'), color, points: trend, area: true },
    ]
    const first = pts[0]
    const last = pts[pts.length - 1]
    const aria =
      t('chartAria', { range: t(`chart_${range}`), n: pts.length, from: wText(first.trendKg, unit), to: wText(last.trendKg, unit) }) +
      (showGoal && member.goalWeightKg != null ? t('chartAriaGoal', { goal: wText(member.goalWeightKg, unit) }) : '')
    return { series, refLines, markers, showGoal, aria, count: pts.length }
  }, [model.series, model.today, from, unit, color, member.goalWeightKg, member.programStart, program, range])

  const legend: LegendItem[] = [
    { label: t('daily'), color, kind: 'ring' },
    { label: t('trend'), color, kind: 'line' },
    ...(chart?.showGoal ? [{ label: t('goal'), color: 'var(--accent-strong)', kind: 'line' as const }] : []),
  ]
  const total = model.series.length

  return (
    <Card as="section" className="body-chart" aria-labelledby="body-chart-title">
      <CardHeader
        title={<span id="body-chart-title">{t(`chart_${range}`)}</span>}
        action={chart && total >= 2 ? <Legend items={legend} className="body-chart__legend" /> : undefined}
      />
      {total < 2 ? (
        <EmptyState compact icon="chart" title={t('chartEmpty')} />
      ) : !chart ? (
        <EmptyState compact icon="calendar" title={t('rangeEmpty')} />
      ) : (
        <LineChart
          series={chart.series}
          refLines={chart.refLines}
          markers={chart.markers}
          height={height}
          yPadding={0.08}
          legend={false}
          table="hidden"
          formatY={(n) => fmtNum(n, 1)}
          formatTooltipY={(n) => `${fmtNum(n, 1, 1)} ${unit}`}
          formatX={(x) => fmtDate(isoFromMs(x), 'dayMonth')}
          formatTooltipX={(x) => fmtDayLabel(isoFromMs(x))}
          ariaLabel={chart.aria}
        />
      )}
    </Card>
  )
}
