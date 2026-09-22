import { useLang, useT } from '../../i18n'
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

/**
 * The short name of a last-set technique. In English it stays as written in the program ("Failure + LLPs (Extend
 * set)"); in Greek the known ones are translated ("Αποτυχία + μισές") and custom ones are shown as written.
 */
export function useTechniqueLabel(tech: Technique | null): string | null {
  const t = useT(M)
  const lang = useLang()
  if (!tech) return null
  if (lang === 'en') return tech.label
  switch (tech.key) {
    case 'failure':
      return t('techLabelFailure')
    case 'myo':
      return t('techLabelMyo')
    case 'llp':
      return t('techLabelLlp')
    case 'stretch':
      return t('techLabelStretch')
    default:
      return tech.label
  }
}
