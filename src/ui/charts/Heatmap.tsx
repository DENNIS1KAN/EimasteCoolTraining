import { useMemo } from 'react'
import { localeOf, useLang, useT, type Lang } from '../../i18n'
import { addDays, fromISODate } from '../../lib/dates'
import { ChartTable, type TableMode } from './ChartTable'
import { useScrub, useWidth } from './hooks'
import { DASH, M } from './messages'
import { calendarGrid, clamp, heatLevel, r2, textWidth, type HeatCell } from './scale'
import { LiveReading, Tooltip } from './Tooltip'

export interface HeatDay {
  date: string
  value: number | null
}

export interface HeatmapProps {
  /** One entry per calendar day (YYYY-MM-DD). null = no data that day (drawn as an empty outline). */
  days: HeatDay[]
  /** Hue of the sequential ramp. */
  color: string
  ariaLabel: string
  /** Rows run Monday..Sunday (the only supported layout; the prop documents it). */
  weekStartsMonday?: true
  formatTooltip: (d: HeatDay) => string
  /** Value that maps to the darkest step (default: the largest value). */
  max?: number
  /** Table cells (default: locale number). */
  formatValue?: (n: number) => string
  /** Table row headers (default: weekday + day + month in the app language). */
  formatDate?: (date: string) => string
  /** Header of the table's value column. */
  valueLabel?: string
  /** Largest cell size in px (default 26). */
  maxCell?: number
  table?: TableMode
  className?: string
}

const LEVELS = 4
/** Share of the hue per level, mixed into the track surface (one hue, light to dark). */
const RAMP = [0, 30, 55, 78, 100]
const GAP = 3
const LEFT = 18
const TOP = 18
const MIN_CELL = 12

export const heatFill = (color: string, level: number): string =>
  level <= 0 ? 'var(--surface-3)' : `color-mix(in oklab, ${color} ${RAMP[clamp(level, 1, LEVELS)]}%, var(--surface-3))`

interface Layout {
  cells: HeatCell[]
  weeks: number
  start: string
  cell: number
  width: number
  height: number
  months: { x: number; text: string }[]
  index: Map<number, number>
}

function layoutHeat(days: HeatDay[], W: number, maxCell: number, lang: Lang): Layout | null {
  const avail = W - LEFT
  const fitWeeks = Math.max(1, Math.floor((avail + GAP) / (MIN_CELL + GAP)))
  const grid = calendarGrid(days, fitWeeks)
  if (!grid.cells.length) return null
  const cell = clamp(Math.floor((avail - GAP * (grid.weeks - 1)) / grid.weeks), MIN_CELL, maxCell)
  const colX = (c: number) => LEFT + c * (cell + GAP)
  const monthFmt = new Intl.DateTimeFormat(localeOf(lang), { month: 'short' })
  const months: { x: number; text: string }[] = []
  for (let c = 0; c < grid.weeks; c++) {
    const monday = addDays(grid.start, c * 7)
    const sunday = addDays(monday, 6)
    // A month label sits on the column where the month begins (and on the first column).
    const newMonth = monday.endsWith('-01') || monday.slice(0, 7) !== sunday.slice(0, 7)
    if (c > 0 && !newMonth) continue
    const ref = newMonth && !monday.endsWith('-01') ? sunday : monday
    const text = monthFmt.format(fromISODate(ref)).replace('.', '')
    const x = colX(c)
    const prev = months[months.length - 1]
    if (prev && x < prev.x + textWidth(prev.text, 10.5) + 8) {
      if (months.length > 1 || prev.x !== colX(0)) continue
      months.pop() // the partial first month yields to the month that follows
    }
    months.push({ x, text })
  }
  const index = new Map<number, number>()
  grid.cells.forEach((c, i) => index.set(c.col * 7 + c.row, i))
  return {
    ...grid,
    cell,
    width: colX(grid.weeks - 1) + cell,
    height: TOP + 7 * cell + 6 * GAP,
    months,
    index,
  }
}

export function Heatmap(props: HeatmapProps) {
  const t = useT(M)
  const lang = useLang()
  const [boxRef, width] = useWidth<HTMLDivElement>()
  const maxCell = props.maxCell ?? 26
  const L = useMemo(() => (width ? layoutHeat(props.days, width, maxCell, lang) : null), [props.days, width, maxCell, lang])
  const max = props.max ?? Math.max(0, ...props.days.map((d) => d.value ?? 0))
  const step = (L?.cell ?? 0) + GAP
  const scrub = useScrub({
    count: L?.cells.length ?? 0,
    hitTest: (mx, my) => {
      if (!L) return null
      const col = Math.floor((mx - LEFT + GAP / 2) / step)
      const row = Math.floor((my - TOP + GAP / 2) / step)
      if (row < 0 || row > 6) return null
      return L.index.get(col * 7 + row) ?? null
    },
    move: (key, i) => {
      if (!L) return null
      const c = L.cells[i]
      const d = key === 'ArrowLeft' ? [-1, 0] : key === 'ArrowRight' ? [1, 0] : key === 'ArrowUp' ? [0, -1] : key === 'ArrowDown' ? [0, 1] : null
      if (!d) return null
      const row = c.row + d[1]
      if (row < 0 || row > 6) return i
      return L.index.get((c.col + d[0]) * 7 + row) ?? i
    },
  })
  const weekday = new Intl.DateTimeFormat(localeOf(lang), { weekday: 'narrow' })
  const fmtDate =
    props.formatDate ?? ((d: string) => new Intl.DateTimeFormat(localeOf(lang), { weekday: 'short', day: 'numeric', month: 'short' }).format(fromISODate(d)))
  const fmtValue = props.formatValue ?? ((n: number) => new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: 1 }).format(n))
  const active = L && scrub.active != null && scrub.active < L.cells.length ? L.cells[scrub.active] : null
  const tip = active ? props.formatTooltip({ date: active.date, value: active.value }) : ''
  const tableMode = props.table ?? 'details'
  const colX = (c: number) => LEFT + c * step
  const rowY = (r: number) => TOP + r * step

  return (
    <div className={`ch ch-heatmap${props.className ? ` ${props.className}` : ''}`}>
      <div ref={boxRef} className="ch-box" style={{ height: L?.height ?? 7 * 16 + TOP }}>
        {width != null && !L && <div className="ch-empty">{t('noData')}</div>}
        {L && (
          <div className="ch-plot ch-plot--fit" role="img" aria-label={props.ariaLabel} {...scrub.bind} style={{ width: L.width, height: L.height, touchAction: 'pan-y' }}>
            <svg className="ch-svg" width={L.width} height={L.height} viewBox={`0 0 ${L.width} ${L.height}`} aria-hidden="true" focusable="false">
              {L.months.map((m) => (
                <text key={m.x} className="ch-tick" x={m.x} y={11}>
                  {m.text}
                </text>
              ))}
              {[0, 2, 4].map((r) => (
                <text key={r} className="ch-tick" x={0} y={r2(rowY(r) + L.cell / 2 + 3.5)}>
                  {weekday.format(fromISODate(addDays('2024-01-01', r)))}
                </text>
              ))}
              <g className="ch-anim-fade">
                {L.cells.map((c) => {
                  const level = heatLevel(c.value, max, LEVELS)
                  const rx = L.cell >= 20 ? 4 : 3
                  return c.value == null ? (
                    <rect key={c.date} className="ch-cell ch-cell--empty" x={colX(c.col) + 0.5} y={rowY(c.row) + 0.5} width={L.cell - 1} height={L.cell - 1} rx={rx} />
                  ) : (
                    <rect key={c.date} className="ch-cell" x={colX(c.col)} y={rowY(c.row)} width={L.cell} height={L.cell} rx={rx} style={{ fill: heatFill(props.color, level) }} />
                  )
                })}
              </g>
              {active && (
                <rect className="ch-cell__focus" x={colX(active.col) - 1.5} y={rowY(active.row) - 1.5} width={L.cell + 3} height={L.cell + 3} rx={L.cell >= 20 ? 5 : 4} />
              )}
            </svg>
            {active && (
              <Tooltip
                x={colX(active.col) + (colX(active.col) > L.width * 0.55 ? -4 : L.cell + 4)}
                y={Math.max(0, rowY(active.row) - 6)}
                side={colX(active.col) > L.width * 0.55 ? 'left' : 'right'}
                title={tip}
                rows={[]}
              />
            )}
          </div>
        )}
      </div>
      <LiveReading text={tip} />
      {L && (
        <div className="ch-foot">
          <div className="ch-scale" aria-hidden="true">
            <span>{t('less')}</span>
            {RAMP.map((_, lvl) => (
              <i key={lvl} className="ch-scale__step" style={{ background: heatFill(props.color, lvl) }} />
            ))}
            <span>{t('more')}</span>
          </div>
          {tableMode !== 'none' && (
            <ChartTable
              mode={tableMode}
              caption={props.ariaLabel}
              columns={[t('date'), props.valueLabel ?? '']}
              rows={[...L.cells].reverse().map((c) => [fmtDate(c.date), c.value == null ? DASH : fmtValue(c.value)])}
            />
          )}
        </div>
      )}
    </div>
  )
}
