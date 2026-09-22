import { useMemo } from 'react'
import { useT } from '../../i18n'
import { ChartTable, type TableMode } from './ChartTable'
import { useScrub, useWidth } from './hooks'
import { Legend } from './Legend'
import { DASH, M } from './messages'
import { barPath, crisp, groupLayout, labelStride, linearScale, niceDomain, r2, textWidth, yTickCount, type GroupLayout, type LinearScale } from './scale'
import { LiveReading, readingText, Tooltip, type TipRow } from './Tooltip'

export interface BarSeries {
  id: string
  label: string
  color: string
  /** One value per category; null = no bar. */
  values: (number | null)[]
}

export interface BarChartProps {
  categories: string[]
  series: BarSeries[]
  /** Total height including the category labels. */
  height?: number
  formatY: (n: number) => string
  /** Values in the tooltip and table (default formatY). */
  formatTooltipY?: (n: number) => string
  /** Longer category names for the tooltip and table (default: the category itself). */
  categoryTitles?: string[]
  ariaLabel: string
  /** Stack the series in one column per category instead of grouping them side by side. */
  stacked?: boolean
  /** Default: shown when there are two or more series. */
  legend?: boolean
  emptyLabel?: string
  /** Header of the first table column. */
  xLabel?: string
  table?: TableMode
  className?: string
}

const FONT = 11
const AXIS_BAND = 26
const TOP = 12
const GAP = 2

interface Seg {
  key: string
  d: string
  color: string
}

interface Layout {
  W: number
  H: number
  left: number
  right: number
  top: number
  bottom: number
  y: LinearScale
  yLabels: { v: number; y: number; text: string }[]
  g: GroupLayout
  segs: Seg[][]
  stride: number
}

const num = (v: number | null | undefined): number | null => (v != null && Number.isFinite(v) ? v : null)

function layoutBars(p: BarChartProps, W: number): Layout | null {
  const n = p.categories.length
  if (!n || !p.series.length) return null
  const H = p.height ?? 200
  const top = TOP
  const bottom = H - AXIS_BAND
  const plotH = Math.max(40, bottom - top)
  const vals = p.series.flatMap((s) => s.values.map(num)).filter((v): v is number => v != null)
  if (!vals.length) return null
  let lo = 0
  let hi = 0
  if (p.stacked) {
    for (let i = 0; i < n; i++) {
      let pos = 0
      let neg = 0
      for (const s of p.series) {
        const v = num(s.values[i]) ?? 0
        if (v >= 0) pos += v
        else neg += v
      }
      hi = Math.max(hi, pos)
      lo = Math.min(lo, neg)
    }
  } else {
    lo = Math.min(0, ...vals)
    hi = Math.max(0, ...vals)
  }
  const integer = vals.every(Number.isInteger)
  const nd = niceDomain(lo, hi === lo ? lo + 1 : hi, yTickCount(plotH), integer)
  const y = linearScale(nd.domain, [top + plotH, top])
  const yText = nd.ticks.map((v) => ({ v, text: p.formatY(v), y: y(v) }))
  const left = Math.max(16, ...yText.map((l) => textWidth(l.text, FONT))) + 8
  const right = 4
  const g = groupLayout(left, W - left - right, n, p.stacked ? 1 : p.series.length)
  const y0 = y(0)
  const segs = p.categories.map((_, i) => {
    if (!p.stacked) {
      return p.series.flatMap((s, j) => {
        const v = num(s.values[i])
        if (v == null || v === 0) return []
        return [{ key: s.id, d: barPath(g.barX(i, j), g.barWidth, y0, y(v)), color: s.color }]
      })
    }
    // Stacked: 2px surface gap between segments, only the outermost segment gets the rounded data end.
    const out: Seg[] = []
    let pos = 0
    let neg = 0
    const items = p.series.map((s) => ({ s, v: num(s.values[i]) ?? 0 })).filter((it) => it.v !== 0)
    const lastPos = items.map((it) => it.v > 0).lastIndexOf(true)
    const lastNeg = items.map((it) => it.v < 0).lastIndexOf(true)
    items.forEach(({ s, v }, k) => {
      const from = v > 0 ? pos : neg
      const to = from + v
      if (v > 0) pos = to
      else neg = to
      const outer = k === (v > 0 ? lastPos : lastNeg)
      const a = y(from)
      const b = y(to)
      const dir = b < a ? -1 : 1
      const start = from === 0 ? a : a + dir * GAP // leave the gap on the side facing the previous segment
      if (Math.abs(b - start) < 0.5) return
      out.push({ key: s.id, d: barPath(g.barX(i, 0), g.barWidth, start, b, outer ? 4 : 0), color: s.color })
    })
    return out
  })
  const maxLabel = Math.max(...p.categories.map((c) => textWidth(c, FONT)))
  return {
    W,
    H,
    left,
    right,
    top,
    bottom: top + plotH,
    y,
    yLabels: yText,
    g,
    segs,
    stride: labelStride(g.band, maxLabel),
  }
}

export function BarChart(props: BarChartProps) {
  const t = useT(M)
  const [boxRef, width] = useWidth<HTMLDivElement>()
  const L = useMemo(() => (width ? layoutBars(props, width) : null), [props, width])
  const n = props.categories.length
  const scrub = useScrub({
    count: L ? n : 0,
    hitTest: (mx) => {
      if (!L) return null
      const i = Math.floor((mx - L.left) / L.g.band)
      return i >= 0 && i < n ? i : null
    },
  })
  const height = props.height ?? 200
  const fmtTip = props.formatTooltipY ?? props.formatY
  const titles = props.categoryTitles ?? props.categories
  const showLegend = props.legend ?? props.series.length >= 2
  const tableMode = props.table ?? 'details'
  const active = L && scrub.active != null && scrub.active < n ? scrub.active : null

  const tipRows: TipRow[] =
    active == null
      ? []
      : props.series.map((s) => {
          const v = num(s.values[active])
          return { key: s.id, label: s.label, color: s.color, kind: 'bar', value: v == null ? DASH : fmtTip(v), muted: v == null }
        })
  const tipTitle = active == null ? '' : titles[active] ?? ''

  return (
    <div className={`ch ch-barchart${props.className ? ` ${props.className}` : ''}`}>
      <div ref={boxRef} className="ch-box" style={{ height }}>
        {width != null && !L && <div className="ch-empty">{props.emptyLabel ?? t('noData')}</div>}
        {L && (
          <div className="ch-plot" role="img" aria-label={props.ariaLabel} {...scrub.bind} style={{ touchAction: 'pan-y' }}>
            <svg className="ch-svg" width={L.W} height={L.H} viewBox={`0 0 ${L.W} ${L.H}`} aria-hidden="true" focusable="false">
              {active != null && (
                <rect
                  className="ch-band"
                  x={r2(L.g.center(active) - L.g.band / 2 + 1)}
                  y={L.top - 6}
                  width={r2(Math.max(0, L.g.band - 2))}
                  height={L.bottom - L.top + 6}
                  rx={6}
                />
              )}
              {L.yLabels.map((l) => (
                <g key={l.v}>
                  <line className={l.v === 0 ? 'ch-baseline' : 'ch-grid'} x1={L.left} x2={L.W - L.right} y1={crisp(l.y)} y2={crisp(l.y)} />
                  <text className="ch-tick" x={L.left - 8} y={r2(l.y + 3.5)} textAnchor="end">
                    {l.text}
                  </text>
                </g>
              ))}
              <g className="ch-anim-grow" style={{ transformOrigin: `0 ${r2(L.y(0))}px` }}>
                {L.segs.map((col, i) => (
                  <g key={i} className={active != null && active !== i ? 'is-dim-soft' : undefined}>
                    {col.map((s) => (s.d ? <path key={s.key} className="ch-bar" d={s.d} style={{ fill: s.color }} /> : null))}
                  </g>
                ))}
              </g>
              {props.categories.map((c, i) =>
                i % L.stride === (n - 1) % L.stride ? (
                  <text key={i} className={`ch-tick${active === i ? ' is-active' : ''}`} x={r2(L.g.center(i))} y={L.bottom + 18} textAnchor="middle">
                    {c}
                  </text>
                ) : null,
              )}
            </svg>
            {active != null && (
              <Tooltip
                x={L.g.center(active) + (L.g.center(active) > L.W * 0.55 ? -L.g.groupWidth / 2 : L.g.groupWidth / 2)}
                y={L.top}
                side={L.g.center(active) > L.W * 0.55 ? 'left' : 'right'}
                title={tipTitle}
                rows={tipRows}
              />
            )}
          </div>
        )}
      </div>
      <LiveReading text={active != null ? readingText(tipTitle, tipRows) : ''} />
      {(showLegend || (tableMode === 'details' && L)) && (
        <div className="ch-foot">
          {showLegend && <Legend items={props.series.map((s) => ({ label: s.label, color: s.color, kind: 'bar' }))} />}
          {L && tableMode !== 'none' && (
            <ChartTable
              mode={tableMode}
              caption={props.ariaLabel}
              columns={[props.xLabel ?? '', ...props.series.map((s) => s.label)]}
              rows={props.categories.map((_, i) => [
                titles[i] ?? '',
                ...props.series.map((s) => {
                  const v = num(s.values[i])
                  return v == null ? null : fmtTip(v)
                }),
              ])}
            />
          )}
        </div>
      )}
    </div>
  )
}
