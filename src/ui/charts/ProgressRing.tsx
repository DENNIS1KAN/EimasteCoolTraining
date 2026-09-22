import type { CSSProperties, ReactNode } from 'react'
import { clamp, r2 } from './scale'

export interface ProgressRingProps {
  /** 0..1; values above 1 draw a second, darker lap (up to 2). Negative and NaN read as 0. */
  value: number
  size?: number
  stroke?: number
  color?: string
  /** Default: a light step of `color` mixed into the surface. */
  trackColor?: string
  /** Center label. */
  children?: ReactNode
  ariaLabel: string
  className?: string
}

/** Circular progress for a single ratio against a target (goal progress, weekly sessions, macros). */
export function ProgressRing({ value, size = 64, stroke = 8, color = 'var(--ink)', trackColor, children, ariaLabel, className }: ProgressRingProps) {
  const v = Number.isFinite(value) ? Math.max(0, value) : 0
  const main = clamp(v, 0, 1)
  const over = clamp(v - 1, 0, 1)
  const r = (size - stroke) / 2
  const c = size / 2
  const len = 2 * Math.PI * r
  const track = trackColor ?? `color-mix(in oklab, ${color} 16%, var(--surface))`
  const arc = (frac: number): CSSProperties => ({ strokeDasharray: `${r2(frac * len)} ${r2(len)}`, ['--ch-len' as string]: r2(len) })
  return (
    <div className={`ch ch-ring${className ? ` ${className}` : ''}`} style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} style={{ stroke: track }} />
        {main > 0 && (
          <circle className="ch-ring__arc" cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" transform={`rotate(-90 ${c} ${c})`} style={{ stroke: color, ...arc(main) }} />
        )}
        {over > 0 && (
          <g transform={`rotate(-90 ${c} ${c})`}>
            {/* 2px surface ring separates the second lap from the first. */}
            <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke + 4} strokeLinecap="round" style={{ stroke: 'var(--chart-surface)', strokeDasharray: arc(over).strokeDasharray }} />
            <circle
              className="ch-ring__arc"
              cx={c}
              cy={c}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              style={{ stroke: `color-mix(in oklab, ${color} 65%, var(--ink))`, ...arc(over) }}
            />
          </g>
        )}
      </svg>
      {children != null && <div className="ch-ring__center">{children}</div>}
    </div>
  )
}
