/** Edit-member form model: the draft the coach types into, validated and converted back to a member patch. */
import type { Member, MemberColor, Unit } from '../../../data/types'
import { isISODate } from '../../../lib/dates'
import { kgToUnit, parseNum, unitToKg } from '../../../lib/units'

export interface MemberDraft {
  name: string
  color: MemberColor
  competes: boolean
  goal: string
  /** Goal body weight in the viewer's unit, as typed ("" = none). */
  goalWeight: string
  /** Height in cm, as typed ("" = unknown). */
  height: string
  /** "" = no program. */
  programId: string
  /** "" = not started. */
  programStart: string
}

export type DraftErrors = Partial<Record<'name' | 'goalWeight' | 'height' | 'programStart', 'required' | 'range' | 'invalid'>>

export const NAME_MAX = 40
export const GOAL_KG = { min: 30, max: 300 }
export const HEIGHT_CM = { min: 100, max: 250 }

const round1 = (n: number): number => Math.round(n * 10) / 10

export function toDraft(m: Member, unit: Unit): MemberDraft {
  return {
    name: m.name,
    color: m.color,
    competes: m.competes,
    goal: m.goal,
    goalWeight: m.goalWeightKg == null ? '' : String(round1(kgToUnit(m.goalWeightKg, unit))),
    height: m.heightCm == null ? '' : String(Math.round(m.heightCm)),
    programId: m.programId ?? '',
    programStart: m.programStart ?? '',
  }
}

export function draftEquals(a: MemberDraft, b: MemberDraft): boolean {
  return (Object.keys(a) as (keyof MemberDraft)[]).every((k) => a[k] === b[k])
}

/** Validate a draft and build the member fields to write. `patch` is null while there are errors. */
export function fromDraft(d: MemberDraft, unit: Unit): { patch: Partial<Member> | null; errors: DraftErrors } {
  const errors: DraftErrors = {}
  const name = d.name.trim().replace(/\s+/g, ' ')
  if (!name) errors.name = 'required'
  else if (name.length > NAME_MAX) errors.name = 'range'

  let goalWeightKg: number | null = null
  if (d.goalWeight.trim()) {
    const v = parseNum(d.goalWeight)
    if (v == null) errors.goalWeight = 'invalid'
    else {
      const kg = unitToKg(v, unit)
      if (kg < GOAL_KG.min || kg > GOAL_KG.max) errors.goalWeight = 'range'
      // keep what the coach typed exact in their unit (e.g. 175 lb stays 175 lb when shown again)
      else goalWeightKg = unit === 'kg' ? round1(kg) : Math.round(kg * 1000) / 1000
    }
  }

  let heightCm: number | null = null
  if (d.height.trim()) {
    const v = parseNum(d.height)
    if (v == null) errors.height = 'invalid'
    else if (v < HEIGHT_CM.min || v > HEIGHT_CM.max) errors.height = 'range'
    else heightCm = Math.round(v)
  }

  const programId = d.programId || null
  let programStart: string | null = programId && d.programStart ? d.programStart : null
  if (programStart && !isISODate(programStart)) {
    errors.programStart = 'invalid'
    programStart = null
  }

  if (Object.keys(errors).length) return { patch: null, errors }
  return {
    patch: { name, color: d.color, competes: d.competes, goal: d.goal.trim(), goalWeightKg, heightCm, programId, programStart },
    errors,
  }
}
