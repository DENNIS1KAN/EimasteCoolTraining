import type { CSSProperties, ReactNode } from 'react'
import { DASH } from './messages'
import { deltaShares, leaderOf, r2, type Leader } from './scale'

export interface DeltaSide {
  value: number | null
  color: string
  /** Who this side is (used in the accessible label). */
  label: string
}

export interface DeltaBarProps {
  a: DeltaSide
  b: DeltaSide
  format: (n: number) => string
  /** Metric name shown above the bars ("Workouts done"). */
  label?: ReactNode
  /** Override who leads (e.g. H2HRow.winner, or when lower is better). Default: the larger value. */
  leader?: Leader
  /** share: each bar is value / (a + b) of its half (default). leader: value / max(a, b). */
  scale?: 'share' | 'leader'
  /** Accessible summary (default: "<metric>: <a label> <a value>, <b label> <b value>"). */
  ariaLabel?: string
  className?: string
}

const fmtSide = (s: DeltaSide, format: (n: number) => string) => (s.value != null && Number.isFinite(s.value) ? format(s.value) : DASH)

/**
 * The "tale of the tape" row: two bars growing from the center toward each athlete's side,
 * the leader's number in strong ink and the trailing bar a lighter step of its own hue.
 */
export function DeltaBar({ a, b, format, label, leader, scale = 'share', ariaLabel, className }: DeltaBarProps) {
  const lead = leader !== undefined ? leader : leaderOf(a.value, b.value)
  const [fa, fb] = deltaShares(a.value, b.value, scale)
  const va = fmtSide(a, format)
  const vb = fmtSide(b, format)
  const summary = ariaLabel ?? `${typeof label === 'string' ? `${label}: ` : ''}${a.label} ${va}, ${b.label} ${vb}`
  const fill = (s: DeltaSide, isLead: boolean): CSSProperties => ({
    background: lead === null || lead === 'tie' || isLead ? s.color : `color-mix(in oklab, ${s.color} 45%, var(--surface))`,
  })
  return (
    <div className={`ch ch-delta${className ? ` ${className}` : ''}`} role="img" aria-label={summary}>
      {label != null && (
        <div className="ch-delta__label" aria-hidden="true">
          {label}
        </div>
      )}
      <div className="ch-delta__row" aria-hidden="true">
        <span className={`ch-delta__value ch-delta__value--a${lead === 'a' ? ' is-lead' : ''}`}>{va}</span>
        <span className="ch-delta__half ch-delta__half--a">
          {fa > 0 && <i className="ch-delta__bar" style={{ width: `${r2(fa * 100)}%`, ...fill(a, lead === 'a') }} />}
        </span>
        <span className="ch-delta__half ch-delta__half--b">
          {fb > 0 && <i className="ch-delta__bar" style={{ width: `${r2(fb * 100)}%`, ...fill(b, lead === 'b') }} />}
        </span>
        <span className={`ch-delta__value ch-delta__value--b${lead === 'b' ? ' is-lead' : ''}`}>{vb}</span>
      </div>
    </div>
  )
}
