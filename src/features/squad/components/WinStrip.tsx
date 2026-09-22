import type { H2HRow } from '../../../lib/stats'
import { memberColorVar } from '../../../ui'
import type { Member } from '../../../data/types'

/** One segment per compared metric: the left corner's wins, then draws, then the right corner's wins. */
export function WinStrip({ rows, a, b, label }: { rows: H2HRow[]; a: Member; b: Member; label?: string }) {
  const wa = rows.filter((r) => r.winner === 'a').length
  const wb = rows.filter((r) => r.winner === 'b').length
  const rest = rows.length - wa - wb
  const segs = [
    ...Array.from({ length: wa }, () => memberColorVar(a.color)),
    ...Array.from({ length: rest }, () => ''),
    ...Array.from({ length: wb }, () => memberColorVar(b.color)),
  ]
  return (
    <div className="sq-wins" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {segs.map((c, i) => (
        <i key={i} className={c ? undefined : 'is-draw'} style={c ? { background: c } : undefined} />
      ))}
    </div>
  )
}
