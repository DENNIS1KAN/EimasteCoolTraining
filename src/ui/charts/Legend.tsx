import type { CSSProperties } from 'react'

export type KeyKind = 'line' | 'bar' | 'dot' | 'ring'

export interface LegendItem {
  label: string
  /** Any CSS color, usually a member token such as var(--m-blue). */
  color: string
  /** Swatch shape; mirrors the mark (line for lines, bar for bars). Default: dot. */
  kind?: KeyKind
}

/** Sets the swatch color through a custom property so CSS picks background vs. outline per kind. */
export const keyColor = (color: string): CSSProperties => ({ ['--ch-c' as string]: color }) as CSSProperties

export function Key({ color, kind = 'dot' }: { color: string; kind?: KeyKind }) {
  return <i className={`ch-key ch-key--${kind}`} style={keyColor(color)} aria-hidden="true" />
}

/** Series identity: a colored swatch beside ink-colored text (text never wears the series color). */
export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  if (!items.length) return null
  return (
    <ul className={`ch-legend${className ? ` ${className}` : ''}`}>
      {items.map((it, i) => (
        <li key={`${it.label}-${i}`} className="ch-legend__item">
          <Key color={it.color} kind={it.kind} />
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  )
}
