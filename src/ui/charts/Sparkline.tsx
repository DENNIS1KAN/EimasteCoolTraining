import { useMemo } from 'react'
import { useWidth } from './hooks'
import { areaPath, linearScale, linePath, r2, type Pt } from './scale'

export interface SparklineProps {
  values: number[] | Pt[]
  color: string
  height?: number
  area?: boolean
  endDot?: boolean
  ariaLabel: string
  className?: string
}

const PAD = 6 // room for the 8px end dot and its ring

const toPts = (values: number[] | Pt[]): Pt[] =>
  (values as (number | Pt)[])
    .map((v, i) => (typeof v === 'number' ? { x: i, y: v } : v))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x)

/** A word-sized trend for stat tiles: no axes, no interaction; the tile's number carries the value. */
export function Sparkline({ values, color, height = 36, area = true, endDot = true, ariaLabel, className }: SparklineProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const geo = useMemo(() => {
    const pts = toPts(values)
    if (!width || !pts.length) return null
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const x = linearScale([xs[0], xs[xs.length - 1]], [PAD / 2, width - PAD])
    const lo = Math.min(...ys)
    const hi = Math.max(...ys)
    const y = linearScale(lo === hi ? [lo - 1, hi + 1] : [lo, hi], [height - PAD, PAD])
    const screen = pts.map((p) => [x(p.x), y(p.y)] as [number, number])
    return { screen, width, base: height - 1 }
  }, [values, width, height])
  const last = geo?.screen[geo.screen.length - 1]
  return (
    <div ref={ref} className={`ch ch-spark${className ? ` ${className}` : ''}`} style={{ height }} role="img" aria-label={ariaLabel}>
      {geo && (
        <svg className="ch-svg" width={geo.width} height={height} viewBox={`0 0 ${geo.width} ${height}`} aria-hidden="true" focusable="false">
          {area && geo.screen.length > 1 && <path className="ch-area" d={areaPath(geo.screen, geo.base)} style={{ fill: color }} />}
          {geo.screen.length > 1 && <path className="ch-line" d={linePath(geo.screen)} style={{ stroke: color }} />}
          {endDot && last && <circle className="ch-dot" cx={r2(last[0])} cy={r2(last[1])} r={5} style={{ fill: color }} />}
        </svg>
      )}
    </div>
  )
}
