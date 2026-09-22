import { Key, type KeyKind } from './Legend'

export interface TipRow {
  key: string
  label: string
  value: string
  color: string
  kind?: KeyKind
  muted?: boolean
}

export interface TooltipProps {
  /** Anchor in px inside the chart box: x, and y from the top (or from the bottom with `from="bottom"`). */
  x: number
  y: number
  from?: 'top' | 'bottom'
  /** Which side of the anchor the box sits on (flip near the right edge). */
  side: 'left' | 'right' | 'center'
  title: string
  rows: TipRow[]
}

/** Values lead, labels follow: the number is the strong element, the series name secondary. */
export function Tooltip({ x, y, from = 'top', side, title, rows }: TooltipProps) {
  return (
    <div className={`ch-tip ch-tip--${side}`} style={from === 'top' ? { left: x, top: y } : { left: x, bottom: y }} aria-hidden="true">
      <div className="ch-tip__title">{title}</div>
      {rows.map((r) => (
        <div key={r.key} className={`ch-tip__row${r.muted ? ' is-muted' : ''}`}>
          <Key color={r.color} kind={r.kind ?? 'line'} />
          <b className="ch-tip__value">{r.value}</b>
          {r.label && <span className="ch-tip__label">{r.label}</span>}
        </div>
      ))}
    </div>
  )
}

/** Screen-reader echo of the current reading (the tooltip itself is aria-hidden). */
export function LiveReading({ text }: { text: string }) {
  return (
    <div className="ch-sr" aria-live="polite" aria-atomic="true">
      {text}
    </div>
  )
}

export const readingText = (title: string, rows: TipRow[]): string =>
  [title, ...rows.map((r) => (r.label ? `${r.label} ${r.value}` : r.value))].join(', ')
