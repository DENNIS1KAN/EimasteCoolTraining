import { useT } from '../../i18n'
import type { Technique } from './logic/techniques'
import { M } from './messages'

/** The plain-language explanation of a last-set technique (null for custom ones, which are shown as written). */
export function useTechniqueText(tech: Technique | null): string | null {
  const t = useT(M)
  switch (tech?.key) {
    case 'failure':
      return t('techFailure')
    case 'myo':
      return t('techMyo')
    case 'llp':
      return t('techLlp')
    case 'stretch':
      return t('techStretch')
    default:
      return null
  }
}

/** The short name of a last-set technique, as written in the program ("Failure + LLPs (Extend set)"). */
export function useTechniqueLabel(tech: Technique | null): string | null {
  return tech ? tech.label : null
}
