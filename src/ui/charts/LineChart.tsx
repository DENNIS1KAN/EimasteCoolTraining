import { useId, useMemo } from 'react'
import { useT } from '../../i18n'
import { ChartTable, type TableMode } from './ChartTable'
import { useScrub, useWidth } from './hooks'
import { Legend, type LegendItem } from './Legend'
import { DASH, M } from './messages'
import {
  DAY_MS,
  areaPath,
  clamp,
  crisp,
  curvePath,
  formatResolution,
  linearScale,
  MAX_AXIS_TICKS,
  medianGap,
  nearestIndex,
  niceDomain,
  niceTicks,
  paddedExtent,
  placeLabels,
  pointAt,
  r2,
  textWidth,
  timeTicks,
  unionX,
  yTickCount,
  type Curve,
  type Domain,
  type LinearScale,
  type Pt,
} from './scale'
import { LiveReading, readingText, Tooltip, type TipRow } from './Tooltip'

export interface LinePoint {
  x: number
  y: number
}

export interface LineSeries {
  id: string
  label: string
  /** Any CSS color; member series use var(--m-blue) / var(--m-orange) / var(--m-aqua). */
  color: string
  points: LinePoint[]
  /** ~10% wash under the line. */
  area?: boolean
  /** Highlight this series; the others recede. */
  emphasis?: boolean
  /** Default: 'end' for lines, 'all' for point-only series. */
  dots?: 'none' | 'end' | 'all'
  /** false draws the points only, as light hollow rings (e.g. raw weigh-ins under a trend line). */
  line?: boolean
  /**
   * Default 'monotone' (smooth, never overshoots a reading). 'step' holds each value until the next point
   * (cumulative counts, running bests); 'linear' draws straight segments.
   */
  curve?: Curve
}

export interface RefLine {
  y: number
  label: string
}

export interface ChartMarker {
  x: number
  label: string
}

export interface LineChartProps {
  series: LineSeries[]
  /** time: x values are ms timestamps (use fromISODate(date).getTime(), local noon). */
  xType?: 'time' | 'linear'
  /** Total height including the x-axis band. */
  height?: number
  yDomain?: [number, number]
  /** Extra room above and below the data before rounding to ticks, as a fraction of its span (default 0). */
  yPadding?: number
  zeroBaseline?: boolean
  formatY: (n: number) => string
  formatX: (n: number) => string
  formatTooltipX?: (n: number) => string
  /** Values in the tooltip, direct labels and table (default formatY). */
  formatTooltipY?: (n: number) => string
  refLines?: RefLine[]
  markers?: ChartMarker[]
  /** Default: shown when there are two or more series. */
  legend?: boolean
  ariaLabel: string
  emptyLabel?: string
  /** Header of the first table column (default "Date" for time axes). */
  xLabel?: string
  table?: TableMode
  className?: string
}

const FONT = 11
const AXIS_BAND = 26
const TOP = 12
const TOP_MARKERS = 24
const INSET = 6
const DOT_R = 5
const LABEL_GAP = 10

interface Prepared extends LineSeries {
  points: Pt[]
  curve: Curve
  tol: number
}

interface DirectLabel {
  id: string
  x: number
  y: number
  name: string
  value: string
  dim: boolean
}

interface Layout {
  W: number
  H: number
  top: number
  bottom: number
  left: number
  right: number
  series: Prepared[]
  xs: number[]
  x: LinearScale
  y: LinearScale
  yDom: Domain
  yLabels: { y: number; text: string; v: number }[]
  xLabels: { x: number; w: number; text: string }[]
  direct: DirectLabel[]
}

const sortPts = (pts: Pt[]) => pts.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.x - b.x)

function directLabels(
  series: Prepared[],
  xMax: number,
  xSpan: number,
  yPx: (v: number) => number,
  fmt: (n: number) => string,
  W: number,
): { labels: Omit<DirectLabel, 'x'>[]; width: number } {
  const none = { labels: [], width: 0 }
  const lined = series.filter((s) => s.line !== false && s.points.length)
  if (!lined.length || lined.length > 4 || W < 240) return none
  const ends = lined.map((s) => ({ s, p: s.points[s.points.length - 1] }))
  // Only label lines that reach the right edge; a label floating mid-plot would sit on other lines.
  if (ends.some(({ p }) => p.x < xMax - xSpan * 0.04)) return none
  const ys = ends.map(({ p }) => yPx(p.y)).sort((a, b) => a - b)
  if (ys.some((v, i) => i > 0 && v - ys[i - 1] < 14)) return none
  const dimmed = series.some((s) => s.emphasis)
  const full = ends.map(({ s, p }) => ({ id: s.id, y: yPx(p.y), name: lined.length > 1 ? s.label : '', value: fmt(p.y), dim: dimmed && !s.emphasis }))
  const widthOf = (l: { name: string; value: string }) =>
    (l.name ? textWidth(l.name, FONT) + (l.value ? 4 : 0) : 0) + (l.value ? Math.ceil(textWidth(l.value, 12) * 1.08) : 0)
  // Name + value when there's room; the value alone (the end dot beside it carries identity) on narrow screens.
  for (const labels of [full, full.map((l) => ({ ...l, name: '' }))]) {
    const width = Math.max(...labels.map(widthOf))
    if (width <= W * 0.26) return { labels, width }
  }
  return none
}

function layoutLine(p: LineChartProps, W: number): Layout | null {
  const H = p.height ?? 220
  const series: Prepared[] = p.series.map((s) => {
    const points = sortPts(s.points)
    return { ...s, points, curve: s.curve ?? 'monotone', tol: medianGap(points.map((q) => q.x)) / 2 }
  })
  const xs = unionX(series)
  if (!xs.length) return null
  const time = (p.xType ?? 'time') === 'time'
  const fmtTipY = p.formatTooltipY ?? p.formatY

  const markerXs = (p.markers ?? []).map((m) => m.x).filter(Number.isFinite)
  let x0 = Math.min(xs[0], ...markerXs)
  const x1 = Math.max(xs[xs.length - 1], ...markerXs)
  // A lone reading sits at the right edge (where "today" is) with room for its label.
  if (x0 === x1) x0 -= time ? 6 * DAY_MS : 1

  const top = p.markers?.length ? TOP_MARKERS : TOP
  const bottom = H - AXIS_BAND
  const plotH = Math.max(40, bottom - top)
  const ys = series.flatMap((s) => s.points.map((q) => q.y))
  const refYs = (p.refLines ?? []).map((r) => r.y).filter(Number.isFinite)
  const integer = [...ys, ...refYs].every(Number.isInteger)
  // At most 4 labelled gridlines (spec), on steps the y labels can print exactly (no "+0.3" on a 0.25 grid).
  const count = yTickCount(plotH)
  const tickOpts = { maxIntervals: count, resolution: formatResolution(p.formatY, Math.min(...ys, ...refYs), Math.max(...ys, ...refYs)) }
  let yDom: Domain
  let yTicks: number[]
  if (p.yDomain) {
    yDom = p.yDomain
    yTicks = niceTicks(yDom[0], yDom[1], count, integer, tickOpts)
  } else {
    // Goal lines get a little air so they never sit on the plot edge, where they'd read as the axis.
    const span = Math.max(...ys, ...refYs) - Math.min(...ys, ...refYs) || 1
    const refRoom = refYs.flatMap((v) => [v - span * 0.06, v + span * 0.06])
    const ext = paddedExtent([...ys, ...refRoom], p.yPadding ?? 0, !!p.zeroBaseline) ?? [0, 1]
    const nd = niceDomain(ext[0], ext[1], count, integer, tickOpts)
    yDom = nd.domain
    yTicks = nd.ticks
  }
  const y = linearScale(yDom, [top + plotH, top])
  const yText = yTicks.map((v) => ({ v, text: p.formatY(v) }))
  const left = Math.max(16, ...yText.map((l) => textWidth(l.text, FONT))) + 8

  const dl = directLabels(series, x1, x1 - x0, y, fmtTipY, W)
  const right = dl.labels.length ? dl.width + LABEL_GAP + 4 : 8
  const x = linearScale([x0, x1], [left + INSET, W - right - INSET])
  const plotW = Math.max(1, W - right - INSET - (left + INSET))

  const labelW = (t: number) => textWidth(p.formatX(t), FONT)
  let ticks: number[]
  if (time) ticks = timeTicks([x0, x1], plotW, labelW, 12, MAX_AXIS_TICKS)
  else {
    const maxW = Math.max(labelW(x0), labelW(x1))
    const n = clamp(Math.floor(plotW / (maxW + 24)), 2, MAX_AXIS_TICKS - 1)
    ticks = niceTicks(x0, x1, n, xs.every(Number.isInteger), {
      maxIntervals: MAX_AXIS_TICKS - 1,
      resolution: formatResolution(p.formatX, x0, x1),
    })
  }
  const xLabels = placeLabels(
    ticks.map((t) => ({ x: x(t), w: labelW(t), text: p.formatX(t) })),
    0,
    W,
    8,
  )

  return {
    W,
    H,
    top,
    bottom: top + plotH,
    left,
    right,
    series,
    xs,
    x,
    y,
    yDom,
    yLabels: yText.map((l) => ({ ...l, y: y(l.v) })),
    xLabels,
    direct: dl.labels.map((l) => ({ ...l, x: W - right + LABEL_GAP - INSET + DOT_R })),
  }
}

/** Keep the tooltip clear of the values being read: above them when it fits, else below, else in the larger gap. */
function tipVertical(L: Layout, readings: { pt: Pt | null }[]): { y: number; from: 'top' | 'bottom' } {
  const ys = readings.flatMap(({ pt }) => (pt ? [L.y(pt.y)] : []))
  if (!ys.length) return { y: L.top, from: 'top' }
  const est = 30 + 20 * readings.length
  const above = Math.min(...ys) - L.top - 8
  const below = L.bottom - Math.max(...ys) - 8
  const top = above >= est || (below < est && above >= below)
  return top ? { y: L.top, from: 'top' } : { y: L.H - L.bottom + 6, from: 'bottom' }
}

/** Every series' reading at union position `i`. */
function readingsAt(L: Layout, i: number) {
  const xv = L.xs[i]
  return L.series.map((s) => ({ s, pt: pointAt(s.points, xv, s.curve, s.tol) }))
}

export function LineChart(props: LineChartProps) {
  const t = useT(M)
  const gid = useId().replace(/:/g, '')
  const [boxRef, width] = useWidth<HTMLDivElement>()
  const L = useMemo(() => (width ? layoutLine(props, width) : null), [props, width])
  const scrub = useScrub({
    count: L?.xs.length ?? 0,
    hitTest: (mx) => (L ? nearestIndex(L.xs, L.x.invert(mx)) : null),
  })
  const height = props.height ?? 220
  const fmtTipX = props.formatTooltipX ?? props.formatX
  const fmtTipY = props.formatTooltipY ?? props.formatY
  const hasEmphasis = props.series.some((s) => s.emphasis)
  const showLegend = props.legend ?? props.series.length >= 2

  const active = L && scrub.active != null && scrub.active < L.xs.length ? scrub.active : null
  const readings = L && active != null ? readingsAt(L, active) : []
  const tipRows: TipRow[] = readings.map(({ s, pt }) => ({
    key: s.id,
    color: s.color,
    kind: s.line === false ? 'ring' : 'line',
    value: pt ? fmtTipY(pt.y) : DASH,
    label: pt && L && pt.x !== L.xs[active!] && s.curve !== 'step' ? `${s.label} · ${fmtTipX(pt.x)}` : s.label,
    muted: !pt,
  }))
  const tipTitle = L && active != null ? fmtTipX(L.xs[active]) : ''

  const legendItems: LegendItem[] = props.series.map((s) => ({ label: s.label, color: s.color, kind: s.line === false ? 'ring' : 'line' }))
  const tableMode = props.table ?? 'details'

  return (
    <div className={`ch ch-linechart${props.className ? ` ${props.className}` : ''}`}>
      <div ref={boxRef} className="ch-box" style={{ height }}>
        {width != null && !L && <div className="ch-empty">{props.emptyLabel ?? t('noData')}</div>}
        {L && (
          <div className="ch-plot" role="img" aria-label={props.ariaLabel} {...scrub.bind} style={{ touchAction: 'pan-y' }}>
            <svg className="ch-svg" width={L.W} height={L.H} viewBox={`0 0 ${L.W} ${L.H}`} aria-hidden="true" focusable="false">
              <defs>
                {/* The area fades out downwards. currentColor picks up each series' own color. */}
                <linearGradient id={`${gid}-area`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="currentColor" stopOpacity="0.3" />
                  <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <Axes L={L} />
              <Markers L={L} markers={props.markers ?? []} />
              <RefLines L={L} refLines={props.refLines ?? []} />
              <g className="ch-anim-wipe">
                {L.series.map((s) => (s.area && s.points.length > 1 ? <AreaMark key={s.id} L={L} s={s} gid={gid} dim={hasEmphasis && !s.emphasis} /> : null))}
                {[...L.series]
                  .sort((a, b) => Number(!!a.emphasis) - Number(!!b.emphasis))
                  .map((s) => (
                    <SeriesMarks key={s.id} L={L} s={s} dim={hasEmphasis && !s.emphasis} />
                  ))}
              </g>
              {active != null && <Crosshair L={L} xv={L.xs[active]} readings={readings} />}
              {L.direct.map((d) => (
                <text key={d.id} className={`ch-dl${d.dim ? ' is-dim' : ''}`} x={r2(d.x)} y={r2(d.y + 4)}>
                  {d.name && <tspan className="ch-dl__name">{d.name}</tspan>}
                  {d.value && (
                    <tspan className="ch-dl__value" dx={d.name ? 4 : 0}>
                      {d.value}
                    </tspan>
                  )}
                </text>
              ))}
            </svg>
            {active != null && (
              <Tooltip
                x={L.x(L.xs[active])}
                {...tipVertical(L, readings)}
                side={L.x(L.xs[active]) > L.W * 0.55 ? 'left' : 'right'}
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
          {showLegend && <Legend items={legendItems} />}
          {L && tableMode !== 'none' && (
            <ChartTable
              mode={tableMode}
              caption={props.ariaLabel}
              columns={[props.xLabel ?? ((props.xType ?? 'time') === 'time' ? t('date') : ''), ...props.series.map((s) => s.label)]}
              rows={L.xs.map((xv) => [
                fmtTipX(xv),
                ...L.series.map((s) => {
                  const p = s.points.find((q) => q.x === xv)
                  return p ? fmtTipY(p.y) : null
                }),
              ])}
            />
          )}
        </div>
      )}
    </div>
  )
}

function Axes({ L }: { L: Layout }) {
  const x1 = L.left
  const x2 = L.W - L.right
  return (
    <g className="ch-axes">
      {L.yLabels.map((l, i) => (
        <g key={l.v}>
          <line className={i === 0 && l.v === L.yDom[0] ? 'ch-baseline' : 'ch-grid'} x1={x1} x2={x2} y1={crisp(l.y)} y2={crisp(l.y)} />
          <text className="ch-tick" x={L.left - 8} y={r2(l.y + 3.5)} textAnchor="end">
            {l.text}
          </text>
        </g>
      ))}
      {L.xLabels.map((l) => (
        <text key={`${l.x}-${l.text}`} className="ch-tick" x={r2(l.x)} y={L.bottom + 18} textAnchor="middle">
          {l.text}
        </text>
      ))}
    </g>
  )
}

function Markers({ L, markers }: { L: Layout; markers: ChartMarker[] }) {
  return (
    <g className="ch-markers">
      {markers.map((m, i) => {
        const px = L.x(m.x)
        if (!Number.isFinite(px)) return null
        const w = textWidth(m.label, 10.5)
        const flip = px + 5 + w > L.W - 2
        return (
          <g key={i}>
            <line className="ch-marker" x1={crisp(px)} x2={crisp(px)} y1={L.top - 14} y2={L.bottom} />
            <text className="ch-marker__label" x={r2(flip ? px - 5 : px + 5)} y={L.top - 6} textAnchor={flip ? 'end' : 'start'}>
              {m.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function RefLines({ L, refLines }: { L: Layout; refLines: RefLine[] }) {
  return (
    <g className="ch-refs">
      {refLines.map((r, i) => {
        if (r.y < L.yDom[0] || r.y > L.yDom[1]) return null
        const py = crisp(L.y(r.y))
        const above = py - 16 >= L.top
        return (
          <g key={i}>
            <line className="ch-ref" x1={L.left} x2={L.W - L.right} y1={py} y2={py} />
            <text className="ch-ref__label ch-halo" x={L.left + INSET} y={above ? py - 5 : py + 13}>
              {r.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

const screen = (L: Layout, s: Prepared): [number, number][] => s.points.map((q) => [L.x(q.x), L.y(q.y)])

function AreaMark({ L, s, gid, dim }: { L: Layout; s: Prepared; gid: string; dim: boolean }) {
  const base = L.y(clamp(0, L.yDom[0], L.yDom[1]))
  return (
    <path
      className={`ch-area ch-area--grad${dim ? ' is-dim' : ''}`}
      d={areaPath(screen(L, s), base, s.curve)}
      style={{ color: s.color, fill: `url(#${gid}-area)` }}
    />
  )
}

function SeriesMarks({ L, s, dim }: { L: Layout; s: Prepared; dim: boolean }) {
  const pts = screen(L, s)
  const lined = s.line !== false
  const dots = s.dots ?? (lined ? 'end' : 'all')
  const dotPts = dots === 'all' ? pts : dots === 'end' && pts.length ? [pts[pts.length - 1]] : []
  return (
    <g className={`ch-series${dim ? ' is-dim' : ''}`}>
      {lined && pts.length > 1 && <path className="ch-line" d={curvePath(pts, s.curve)} style={{ stroke: s.color }} />}
      {dotPts.map(([cx, cy], i) =>
        lined ? (
          <g key={i}>
            {dots === 'end' && <circle className="ch-dot__halo" cx={r2(cx)} cy={r2(cy)} r={9.5} style={{ fill: s.color }} />}
            <circle className="ch-dot" cx={r2(cx)} cy={r2(cy)} r={DOT_R} style={{ fill: s.color }} />
          </g>
        ) : (
          <circle key={i} className="ch-dot--scatter" cx={r2(cx)} cy={r2(cy)} r={2.1} style={{ fill: s.color }} />
        ),
      )}
    </g>
  )
}

function Crosshair({ L, xv, readings }: { L: Layout; xv: number; readings: { s: Prepared; pt: Pt | null }[] }) {
  const px = crisp(L.x(xv))
  return (
    <g className="ch-cross">
      <line className="ch-cross__line" x1={px} x2={px} y1={L.top - 4} y2={L.bottom} />
      {readings.map(({ s, pt }) =>
        !pt ? null : s.line === false ? (
          <circle key={s.id} className="ch-dot--ring" cx={r2(L.x(pt.x))} cy={r2(L.y(pt.y))} r={4.5} style={{ stroke: s.color }} />
        ) : (
          <circle key={s.id} className="ch-dot" cx={r2(L.x(pt.x))} cy={r2(L.y(pt.y))} r={DOT_R} style={{ fill: s.color }} />
        ),
      )}
    </g>
  )
}
