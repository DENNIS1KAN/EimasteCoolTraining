import { beforeEach, describe, expect, it } from 'vitest'
import { __resetForTests, getState, setState } from '../../data/store'
import { mkMember, mkWeight } from '../../lib/testing/fixtures'
import { deleteWeighIn, saveWeighIn, setGoalWeight } from './actions'

const input = (date: string, kg: number) => ({ memberId: 's', date, kg, bodyFat: null, waistCm: null, note: '  salty  ' })

describe('body actions', () => {
  beforeEach(() => {
    __resetForTests()
    setState({ status: 'ready', meId: 's', members: { s: mkMember({ id: 's' }) } })
  })

  it('saves one weigh-in per day with a deterministic id and a trimmed note; undo removes it', () => {
    const undo = saveWeighIn(input('2026-09-24', 80.7))
    const row = getState().weights['s__2026-09-24']
    expect(row).toMatchObject({ memberId: 's', date: '2026-09-24', kg: 80.7, note: 'salty' })
    expect(row.updatedAt).toBeGreaterThan(0)
    undo()
    expect(getState().weights['s__2026-09-24']).toBeUndefined()
  })

  it('replacing a day restores the previous value on undo', () => {
    setState({ weights: { 's__2026-09-24': mkWeight('s', '2026-09-24', 81) } })
    const undo = saveWeighIn(input('2026-09-24', 80.5))
    expect(getState().weights['s__2026-09-24'].kg).toBe(80.5)
    undo()
    expect(getState().weights['s__2026-09-24'].kg).toBe(81)
  })

  it('moves an entry when its date changes, and undo moves it back', () => {
    setState({ weights: { 's__2026-09-23': mkWeight('s', '2026-09-23', 81) } })
    const undo = saveWeighIn(input('2026-09-22', 81), 's__2026-09-23')
    expect(Object.keys(getState().weights)).toEqual(['s__2026-09-22'])
    undo()
    expect(Object.keys(getState().weights)).toEqual(['s__2026-09-23'])
  })

  it('deletes with undo', () => {
    setState({ weights: { 's__2026-09-23': mkWeight('s', '2026-09-23', 81) } })
    const undo = deleteWeighIn('s__2026-09-23')
    expect(getState().weights).toEqual({})
    undo()
    expect(getState().weights['s__2026-09-23'].kg).toBe(81)
  })

  it('sets and clears the goal weight', () => {
    setGoalWeight('s', 78)
    expect(getState().members.s.goalWeightKg).toBe(78)
    setGoalWeight('s', null)
    expect(getState().members.s.goalWeightKg).toBeNull()
  })
})
