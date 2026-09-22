import type { ReactNode } from 'react'
import { clamp } from './scale'

export interface MeterProps {
  value: number
  max: number
  /** Fill color (default ink). The track is a lighter step of it. */
  color?: string
  /** Text above the bar, left. */
  label?: ReactNode
  /** Text above the bar, right (e.g. "132 / 180 g"). */
  valueLabel?: ReactNode
  ariaLabel: string
  /** Bar thickness in px (default 6). */
  thickness?: number
  className?: string
}

/**
 * A single ratio against a limit, as a horizontal bar on a same-hue track.
 * Past the limit the bar fills and a 2px surface notch marks where the limit sits.
 */
export function Meter({ value, max, color = 'var(--ink)', label, valueLabel, ariaLabel, thickness = 6, className }: MeterProps) {
  const v = Number.isFinite(value) ? value : 0
  const ratio = max > 0 ? v / max : 0
  const pct = clamp(ratio, 0, 1) * 100
  const over = ratio > 1
  const limitAt = over ? (1 / ratio) * 100 : null
  return (
    <div className={`ch ch-meter${over ? ' is-over' : ''}${className ? ` ${className}` : ''}`}>
      {(label != null || valueLabel != null) && (
        <div className="ch-meter__head" aria-hidden="true">
          {label != null && <span className="ch-meter__label">{label}</span>}
          {valueLabel != null && <span className="ch-meter__value">{valueLabel}</span>}
        </div>
      )}
      <div
        className="ch-meter__track"
        role="meter"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamp(v, 0, Math.max(0, max))}
        style={{ height: thickness, background: `color-mix(in oklab, ${color} 16%, var(--surface))` }}
      >
        <div className="ch-meter__fill" style={{ width: `${pct}%`, background: color }} />
        {limitAt != null && <div className="ch-meter__limit" style={{ left: `${limitAt}%` }} />}
      </div>
    </div>
  )
}
