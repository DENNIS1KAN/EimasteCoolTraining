import type { Member } from '../../../data/types'
import { useT } from '../../../i18n'
import type { Clause, ClauseKind, Region } from '../logic/compare'
import { SQ } from '../messages'

type K = keyof typeof SQ.en
const REGION: Record<Region, K> = { legs: 'regionLegs', push: 'regionPush', pull: 'regionPull' }
const KEYS: Record<Exclude<ClauseKind, 'lifts'>, [K, K]> = {
  consistency: ['sConsistencyYou', 'sConsistencyOther'],
  volume: ['sVolumeYou', 'sVolumeOther'],
  prs: ['sPrsYou', 'sPrsOther'],
  gains: ['sGainsYou', 'sGainsOther'],
  streak: ['sStreakYou', 'sStreakOther'],
  nutrition: ['sNutritionYou', 'sNutritionOther'],
}

/** Turns summary clauses into one friendly sentence: "Thanos out-lifts you on legs; you're more consistent." */
export function useSummaryText() {
  const t = useT(SQ)
  return (clauses: Clause[], a: Member, b: Member, viewerId: string | null | undefined): string => {
    const parts = clauses.map((c) => {
      const subj = c.who === 'a' ? a : b
      const obj = c.who === 'a' ? b : a
      if (c.kind === 'lifts') {
        const region = t(REGION[c.region ?? 'legs'])
        if (subj.id === viewerId) return t('sLiftsYou', { other: obj.name, region })
        if (obj.id === viewerId) return t('sLiftsYouObj', { name: subj.name, region })
        return t('sLiftsOther', { name: subj.name, other: obj.name, region })
      }
      const [you, other] = KEYS[c.kind]
      return subj.id === viewerId ? t(you) : t(other, { name: subj.name })
    })
    if (!parts.length) return ''
    // "…; you're more consistent" in English, "…, ενώ εσύ…" in Greek (where ";" is a question mark).
    const sep = clauses.length > 1 && clauses[0].who !== clauses[1].who ? t('sepContrast') : t('sepSame')
    const s = parts.join(sep)
    return `${s.charAt(0).toLocaleUpperCase()}${s.slice(1)}.`
  }
}
