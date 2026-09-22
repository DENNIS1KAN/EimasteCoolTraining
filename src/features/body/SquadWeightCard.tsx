import { useMemo } from 'react'
import { useMe, useStore } from '../../data/store'
import { useT } from '../../i18n'
import { fromISODate, isoFromMs } from '../../lib/dates'
import { fmtDate, fmtDayLabel, fmtSigned } from '../../lib/format'
import { Card, CardHeader, EmptyState, Icon, memberColorVar } from '../../ui'
import { LineChart, type LineSeries } from '../../ui/charts'
import { changeSeries, clipSeries, rangeFrom, weightModeFor, type Range } from './logic'
import { M } from './messages'
import { pctSigned } from './format'

/**
 * Everyone's % change since their start on one chart: a fair race between people of different sizes.
 * Only percentages are shown, so members sharing "change" or "exact" are both included; "private" ones are not.
 */
export function SquadWeightCard({ range, today }: { range: Range; today: string }) {
  const t = useT(M)
  const me = useMe()
  const members = useStore((s) => s.members)
  const weights = useStore((s) => s.weights)
  const from = rangeFrom(range, today)

  const data = useMemo(() => {
    const list = Object.values(members)
      .filter((m) => m.competes)
      .sort((a, b) => a.name.localeCompare(b.name))
    const hidden: string[] = []
    const series: LineSeries[] = []
    const ends: string[] = []
    for (const m of list) {
      if (weightModeFor(me, m) === 'hidden') {
        hidden.push(m.name)
        continue
      }
      const entries = Object.values(weights).filter((w) => w.memberId === m.id)
      const pts = clipSeries(changeSeries(entries, m.programStart), from)
      if (!pts.length) continue
      series.push({
        id: m.id,
        label: m.name,
        color: memberColorVar(m.color),
        points: pts.map((p) => ({ x: fromISODate(p.date).getTime(), y: Math.round(p.pct * 1000) / 10 })),
        emphasis: m.id === me?.id,
      })
      ends.push(`${m.name} ${pctSigned(pts[pts.length - 1].pct)}`)
    }
    return { series, hidden, ends }
  }, [members, weights, me, from])
  const aria = t('squadAria', { list: data.ends.join(', ') })

  return (
    <Card as="section" className="body-squad" aria-labelledby="body-squad-title">
      <CardHeader title={<span id="body-squad-title">{t('squadTitle')}</span>} subtitle={t('squadSub')} />
      {data.series.length ? (
        <LineChart
          series={data.series}
          height={176}
          yPadding={0.1}
          refLines={[{ y: 0, label: t('start') }]}
          formatY={(n) => `${fmtSigned(n, 1)}%`}
          formatTooltipY={(n) => `${fmtSigned(n, 1)}%`}
          formatX={(x) => fmtDate(isoFromMs(x), 'dayMonth')}
          formatTooltipX={(x) => fmtDayLabel(isoFromMs(x))}
          ariaLabel={aria}
          table="hidden"
        />
      ) : (
        <EmptyState compact icon="users" title={t('squadEmpty')} body={t('squadEmptyBody')} />
      )}
      {(data.series.length > 0 || data.hidden.length > 0) && (
        <p className="body-squad__foot">
          <Icon name="lock" size={12} />
          <span>
            {t('onlyPct')}
            {data.hidden.length ? ` ${t('squadHidden', { names: data.hidden.join(', ') })}` : ''}
          </span>
        </p>
      )}
    </Card>
  )
}
