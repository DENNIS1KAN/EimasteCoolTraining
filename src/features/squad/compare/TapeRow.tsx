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
 * single bar growing from the center toward whoever is ahead.
 *
 * The bar's length is the MARGIN (|a - b| / max), not the value, so a column of rows reads as "how far
 * ahead or behind am I on each metric" at a glance. Two people level on a metric render an empty track,
 * which is the point: nothing to see, move on.
 */
export function TapeRow({ row, label, sub, va, vb, ca, cb, summary }: TapeRowProps) {
  const a = Math.max(0, row.a ?? 0)
  const b = Math.max(0, row.b ?? 0)
  const max = Math.max(a, b)
  const margin = max > 0 ? (Math.abs(a - b) / max) * 100 : 0
  const wa = row.winner === 'a' ? margin : 0
  const wb = row.winner === 'b' ? margin : 0
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
        <span>{wa > 0 && <i className="is-lead" style={{ width: `${wa}%`, background: ca }} />}</span>
        <span>{wb > 0 && <i className="is-lead" style={{ width: `${wb}%`, background: cb }} />}</span>
      </span>
    </li>
  )
}
