import { useT } from '../../i18n'
import { M } from './messages'

export interface ChartTableColumn {
  label: string
  /** Right-aligned, tabular figures. Default: every column but the first. */
  numeric?: boolean
}

export type TableMode = 'details' | 'hidden' | 'none'

export interface ChartTableProps {
  columns: (string | ChartTableColumn)[]
  rows: (string | number | null)[][]
  caption: string
  /** details: a "Data" disclosure under the chart; hidden: screen readers only. */
  mode?: Exclude<TableMode, 'none'>
  className?: string
}

const norm = (c: string | ChartTableColumn, i: number): ChartTableColumn =>
  typeof c === 'string' ? { label: c, numeric: i > 0 } : { numeric: i > 0, ...c }

/** The accessible twin of every chart: the same numbers as a plain table. */
export function ChartTable({ columns, rows, caption, mode = 'details', className }: ChartTableProps) {
  const t = useT(M)
  const cols = columns.map(norm)
  const table = (
    <table className="ch-table__t">
      <caption className="ch-sr">{caption}</caption>
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th key={i} scope="col" className={c.numeric ? 'is-num' : undefined}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((v, j) =>
              j === 0 ? (
                <th key={j} scope="row">
                  {v ?? ''}
                </th>
              ) : (
                <td key={j} className={cols[j]?.numeric ? 'is-num' : undefined}>
                  {v ?? '–'}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
  if (mode === 'hidden') return <div className={`ch-sr${className ? ` ${className}` : ''}`}>{table}</div>
  return (
    <details className={`ch-table${className ? ` ${className}` : ''}`}>
      <summary className="ch-table__toggle">{t('data')}</summary>
      <div className="ch-table__scroll">{table}</div>
    </details>
  )
}
