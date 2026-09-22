import { describe, expect, it } from 'vitest'
import { mkMember } from '../../../lib/testing/fixtures'
import { draftEquals, fromDraft, toDraft } from './memberForm'

const m = mkMember({ id: 'a', name: 'Stelios', goalWeightKg: 79, heightCm: 183, programStart: '2026-09-07', goal: 'Cut' })

describe('toDraft / fromDraft', () => {
  it('round-trips a member in kg', () => {
    const d = toDraft(m, 'kg')
    expect(d).toMatchObject({ name: 'Stelios', goalWeight: '79', height: '183', programId: 'mini', programStart: '2026-09-07' })
    const { patch, errors } = fromDraft(d, 'kg')
    expect(errors).toEqual({})
    expect(patch).toMatchObject({ name: 'Stelios', goalWeightKg: 79, heightCm: 183, programId: 'mini', programStart: '2026-09-07', goal: 'Cut' })
  })

  it('shows and accepts the goal weight in pounds', () => {
    const d = toDraft(m, 'lb')
    expect(d.goalWeight).toBe('174.2')
    const { patch } = fromDraft({ ...d, goalWeight: '175' }, 'lb')
    expect(patch?.goalWeightKg).toBeCloseTo(79.379, 3)
    expect(toDraft({ ...m, goalWeightKg: patch!.goalWeightKg! }, 'lb').goalWeight).toBe('175')
  })

  it('accepts a decimal comma and empty optional fields', () => {
    const { patch } = fromDraft({ ...toDraft(m, 'kg'), goalWeight: '78,5', height: '' }, 'kg')
    expect(patch?.goalWeightKg).toBe(78.5)
    expect(patch?.heightCm).toBeNull()
  })

  it('validates', () => {
    const base = toDraft(m, 'kg')
    expect(fromDraft({ ...base, name: '  ' }, 'kg').errors.name).toBe('required')
    expect(fromDraft({ ...base, goalWeight: 'abc' }, 'kg').errors.goalWeight).toBe('invalid')
    expect(fromDraft({ ...base, goalWeight: '12' }, 'kg').errors.goalWeight).toBe('range')
    expect(fromDraft({ ...base, height: '300' }, 'kg').errors.height).toBe('range')
    expect(fromDraft({ ...base, programStart: '2026-02-30' }, 'kg').errors.programStart).toBe('invalid')
    expect(fromDraft({ ...base, name: '' }, 'kg').patch).toBeNull()
  })

  it('clears the start date without a program and tidies the name', () => {
    const { patch } = fromDraft({ ...toDraft(m, 'kg'), programId: '', name: '  Stelios   K ' }, 'kg')
    expect(patch).toMatchObject({ programId: null, programStart: null, name: 'Stelios K' })
  })

  it('draftEquals', () => {
    const d = toDraft(m, 'kg')
    expect(draftEquals(d, { ...d })).toBe(true)
    expect(draftEquals(d, { ...d, competes: !d.competes })).toBe(false)
  })
})
