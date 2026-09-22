import { describe, expect, it } from 'vitest'
import { lastSetTechnique, techniqueKey } from './techniques'

describe('techniqueKey', () => {
  it('recognises the BTS techniques', () => {
    expect(techniqueKey('Failure')).toBe('failure')
    expect(techniqueKey('Myo-reps')).toBe('myo')
    expect(techniqueKey('Failure + LLPs (Extend set)')).toBe('llp')
    expect(techniqueKey('Static Stretch (30s)')).toBe('stretch')
  })
  it('returns null for none or unknown techniques', () => {
    expect(techniqueKey('N/A')).toBeNull()
    expect(techniqueKey('Drop set')).toBeNull()
    expect(techniqueKey(undefined)).toBeNull()
  })
})

describe('lastSetTechnique', () => {
  it('is null for N/A and empty', () => {
    expect(lastSetTechnique({ t: 'N/A' }, false)).toBeNull()
    expect(lastSetTechnique({ t: '' }, false)).toBeNull()
  })
  it('keeps the label as written', () => {
    expect(lastSetTechnique({ t: 'Failure + LLPs (Extend set)' }, false)).toEqual({ key: 'llp', label: 'Failure + LLPs (Extend set)' })
    expect(lastSetTechnique({ t: 'Drop set' }, false)).toEqual({ key: null, label: 'Drop set' })
  })
  it('drops failure techniques in intro weeks but keeps stretches', () => {
    expect(lastSetTechnique({ t: 'Failure' }, true)).toBeNull()
    expect(lastSetTechnique({ t: 'Myo-reps' }, true)).toBeNull()
    expect(lastSetTechnique({ t: 'Failure + LLPs (Extend set)' }, true)).toBeNull()
    expect(lastSetTechnique({ t: 'Static Stretch (30s)' }, true)).toEqual({ key: 'stretch', label: 'Static Stretch (30s)' })
  })
})
