import { useMemo } from 'react'
import { useMe, useStore } from '../../data/store'
import { useLang, useT } from '../../i18n'
import { addDays, fromISODate, isoFromMs, todayISO } from '../../lib/dates'
import { fmtDate, fmtDayLabel, fmtNum } from '../../lib/format'
import { weightSeries } from '../../lib/stats'
import { kgToUnit } from '../../lib/units'
import { EmptyState, Icon, memberColorVar } from '../../ui'
import { LineChart, type LineSeries, type RefLine } from '../../ui/charts'
import { useMemberWeights } from './hooks'
import { changeSeries, goalFits, toDisplay, weightModeFor } from './logic'
import { M } from './messages'
import { fixedSigned, wSigned, wText } from './format'
import './body.css'

const ms = (d: string) => fromISODate(d).getTime()

/**
 * A member's weight trend for profiles. Follows their visibility for the viewer:
 * exact → kilos with daily dots and the goal line; change → change from start; private → a lock (except for them and the coach).
 */
export function WeightTrendChart({ memberId, days = 90, height = 200 }: { memberId: string; days?: number; height?: number }) {
  const t = useT(M)
  const lang = useLang()
  const me = useMe()
  const members = useStore((s) => s.members)
  const member = members[memberId] ?? null
  const entries = useMemberWeights(memberId)
  const unit = me?.settings.unit ?? member?.settings.unit ?? 'kg'
  const mode = member ? weightModeFor(me, member) : 'hidden'
  const today = todayISO()

  const chart = useMemo(() => {
    if (!member || mode === 'hidden') return null
    const from = addDays(today, -(days - 1))
    const color = memberColorVar(member.color)
    if (mode === 'exact') {
      const pts = weightSeries(entries).filter((p) => p.date >= from)
      if (pts.length < 2) return null
      const raw = pts.map((p) => ({ x: ms(p.date), y: toDisplay(p.kg, unit) }))
      // Unrounded: the formatters round once (to 0.1), so the chart agrees with the stats shown elsewhere.
      const trend = pts.map((p) => ({ x: ms(p.date), y: kgToUnit(p.trendKg, unit) }))
      const goal = member.goalWeightKg != null ? toDisplay(member.goalWeightKg, unit) : null
      const refLines: RefLine[] =
        goal != null &&
        goalFits(
          trend.map((p) => p.y),
          goal,
          unit,
        )
          ? [{ y: goal, label: t('goalLine', { value: fmtNum(goal, 1, 1) }) }]
          : []
      const series: LineSeries[] = [
        { id: 'daily', label: t('daily'), color, points: raw, line: false },
        { id: 'trend', label: t('trend'), color, points: trend, area: true },
      ]
      return {
        mode,
        series,
        refLines,
        aria: t('trendAria', { name: member.name, n: days, from: wText(pts[0].trendKg, unit), to: wText(pts[pts.length - 1].trendKg, unit) }),
      }
    }
    const pts = changeSeries(entries, member.programStart).filter((p) => p.date >= from)
    if (pts.length < 2) return null
    const series: LineSeries[] = [
      {
        id: 'change',
        label: t('changeAxis'),
        color,
        points: pts.map((p) => ({ x: ms(p.date), y: kgToUnit(p.trendKg, unit) })),
        area: true,
      },
    ]
    const last = pts[pts.length - 1]
    return {
      mode,
      series,
      refLines: [{ y: 0, label: '' }] as RefLine[],
      aria: t('trendAriaChange', { name: member.name, n: days, value: wSigned(last.trendKg, unit) }),
    }
  }, [member, mode, entries, unit, days, today, lang])

  if (!member) return null
  if (mode === 'hidden') {
    return <EmptyState compact icon="lock" title={t('privateTitle')} body={t('privateBody')} />
  }
  if (!chart) {
    return <EmptyState compact icon="scale" title={entries.length ? t('chartEmpty') : t('miniEmpty')} />
  }
  const change = chart.mode === 'change'
  return (
    <div className="body-trend">
      {change && (
        <p className="body-trend__caption">
          <Icon name="eye" size={12} />
          {t('changeOnlyOf', { name: member.name })}
        </p>
      )}
      <LineChart
        series={chart.series}
        refLines={chart.refLines}
        height={height}
        yPadding={0.08}
        legend={!change}
        table="hidden"
        formatY={change ? fixedSigned : (n) => fmtNum(n, 1)}
        formatTooltipY={change ? (n) => `${fixedSigned(n)} ${unit}` : (n) => `${fmtNum(n, 1, 1)} ${unit}`}
        formatX={(x) => fmtDate(isoFromMs(x), 'dayMonth')}
        formatTooltipX={(x) => fmtDayLabel(isoFromMs(x))}
        ariaLabel={chart.aria}
      />
    </div>
  )
}
