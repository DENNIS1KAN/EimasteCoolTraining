import type { Unit } from '../../../data/types'
import { fmtNum, fmtPct, fmtSigned, fmtVolume } from '../../../lib/format'
import type { MetricKey } from '../../../lib/stats'
import type { CategoryKey } from './league'

export const MISSING = '—'

/** A head-to-head / leaderboard value as shown in the UI ("92%", "18.4 t", "+8.2%"). */
export function fmtMetric(key: MetricKey | CategoryKey, v: number | null | undefined, unit: Unit = 'kg'): string {
  if (v == null || !Number.isFinite(v)) return MISSING
  switch (key) {
    case 'consistency':
    case 'goal':
    case 'nutrition':
      return fmtPct(v)
    case 'strength':
      return `${fmtSigned(v * 100, 1)}%`
    case 'volumeWeek':
      return fmtVolume(v, unit)
    default:
      return fmtNum(v, 0)
  }
}
