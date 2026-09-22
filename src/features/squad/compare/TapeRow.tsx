import type { ReactNode } from 'react'
import type { H2HRow } from '../../../lib/stats'

export interface TapeRowProps {
  row: H2HRow
  label: string
  sub?: ReactNode
  va: string
  vb: string
  ca: string
  cb: string
  /** Accessible sentence for the row. */
  summary: string
}

/**
 * Tale-of-the-tape row: values on the outside (the leader's on a pill), the metric in the middle and a
 * butterfly bar growing out from the center; bar length = value / max(a, b), the trailer's at 34%.
 */
export function TapeRow({ row, label, sub, va, vb, ca, cb, summary }: TapeRowProps) {
  const a = Math.max(0, row.a ?? 0)
  const b = Math.max(0, row.b ?? 0)
  const max = Math.max(a, b)
  const wa = max > 0 ? (a / max) * 100 : 0
  const wb = max > 0 ? (b / max) * 100 : 0
  return (
    <li className="sq-tr">
      <span className="visually-hidden">{summary}</span>
      <span className={`sq-tr__v${row.winner === 'a' ? ' is-lead' : ''}`} aria-hidden="true">
        {va}
      </span>
      <span className="sq-tr__l" aria-hidden="true">
        {label}
        {sub ? <small>{sub}</small> : null}
      </span>
      <span className={`sq-tr__v sq-tr__v--b${row.winner === 'b' ? ' is-lead' : ''}`} aria-hidden="true">
        {vb}
      </span>
      <span className="sq-tr__bars" aria-hidden="true">
        <span>{wa > 0 && <i className={row.winner === 'a' || row.winner === 'tie' ? 'is-lead' : undefined} style={{ width: `${wa}%`, background: ca }} />}</span>
        <span>{wb > 0 && <i className={row.winner === 'b' || row.winner === 'tie' ? 'is-lead' : undefined} style={{ width: `${wb}%`, background: cb }} />}</span>
      </span>
    </li>
  )
}
