import { useMemo } from 'react'
import type { Member } from '../../../data/types'
import { useT } from '../../../i18n'
import { headToHead, type H2HRow, type MemberStats } from '../../../lib/stats'
import { fmtScore } from '../format'
import { SQ } from '../messages'

export interface H2H {
  rows: H2HRow[]
  a: number
  b: number
}

/** Head-to-head of two members (stats already filtered for what the viewer may see). */
export function useHeadToHead(stats: Record<string, MemberStats>, a: Member | null, b: Member | null): H2H | null {
  const sa = a ? stats[a.id] : undefined
  const sb = b ? stats[b.id] : undefined
  return useMemo(() => (sa && sb ? headToHead(sa, sb) : null), [sa, sb])
}

/** Short leader label under a score: "You lead" / "Thanos leads" / "All square". */
export function useLeadText() {
  const t = useT(SQ)
  return (h: H2H, a: Member, b: Member, viewerId: string | null | undefined): string => {
    const lead = h.a > h.b ? a : h.b > h.a ? b : null
    if (!lead) return t('allSquare')
    return lead.id === viewerId ? t('youLead') : t('leads', { name: lead.name })
  }
}

/** "You lead Thanos 5–2" / "Thanos leads you 5–2" / "Stelios leads 5–2", from the viewer's point of view. */
export function useScoreLine() {
  const t = useT(SQ)
  return (h: H2H, a: Member, b: Member, viewerId: string | null | undefined): string => {
    const lead = h.a > h.b ? 'a' : h.b > h.a ? 'b' : null
    const hi = Math.max(h.a, h.b)
    const lo = Math.min(h.a, h.b)
    const score = fmtScore(hi, lo)
    if (viewerId === a.id || viewerId === b.id) {
      const meA = viewerId === a.id
      const other = meA ? b : a
      const mine = fmtScore(meA ? h.a : h.b, meA ? h.b : h.a)
      if (!lead) return t('youTieScore', { name: other.name, score, mine })
      const iLead = (lead === 'a') === meA
      return t(iLead ? 'youLeadScore' : 'youTrailScore', { name: other.name, score, mine })
    }
    if (!lead) return t('tieScore', { score })
    return t('leadsScore', { name: (lead === 'a' ? a : b).name, score })
  }
}
