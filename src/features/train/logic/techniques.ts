import type { ProgramExercise } from '../../../data/types'

/** Last-set intensity techniques of the BTS program ("N/A" = none). */
export type TechniqueKey = 'failure' | 'myo' | 'llp' | 'stretch'

export interface Technique {
  /** Known technique (explained and translated), or null for a custom one shown as written. */
  key: TechniqueKey | null
  /** The label as written in the program, e.g. "Failure + LLPs (Extend set)". */
  label: string
}

/** Recognises the program's technique labels (case-insensitive, tolerant of small spelling changes). */
export function techniqueKey(t: string | null | undefined): TechniqueKey | null {
  const s = (t ?? '').toLowerCase()
  if (/llp|lengthened|extend/.test(s)) return 'llp'
  if (/myo/.test(s)) return 'myo'
  if (/stretch/.test(s)) return 'stretch'
  if (/fail/.test(s)) return 'failure'
  return null
}

/**
 * The technique for an exercise's last set, or null when there is none. Intro weeks have no sets to failure,
 * so a technique is only shown there if it isn't a failure technique (custom programs may still list one).
 */
export function lastSetTechnique(e: Pick<ProgramExercise, 't'>, intro: boolean): Technique | null {
  const label = (e.t ?? '').trim()
  if (!label || /^(n\/?a|none|-|—)$/i.test(label)) return null
  const key = techniqueKey(label)
  if (intro && (key === 'failure' || key === 'llp' || key === 'myo' || /fail/i.test(label))) return null
  return { key, label }
}
