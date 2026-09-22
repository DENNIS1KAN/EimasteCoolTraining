import { describe, expect, it } from 'vitest'
import { MINI, mkLog } from '../../../lib/testing/fixtures'
import { bestE1rmByExercise } from '../../../lib/stats'
import { logPRs } from './prs'

describe('logPRs', () => {
  const w1 = mkLog({ week: 1, day: 0, ex: { 0: { sets: [['60', '8']] }, 1: { sets: [['50', '10']] } } })
  const prior = bestE1rmByExercise([w1], { [MINI.id]: MINI })

  it('finds exercises whose best set beats the prior best e1RM', () => {
    const w2 = mkLog({ week: 2, day: 0, done: false, ex: { 0: { sets: [['62.5', '8'], ['60', '6']] }, 1: { sets: [['50', '10']] } } })
    const prs = logPRs(w2, MINI, prior)
    expect(prs.map((p) => p.exercise)).toEqual(['Bench Press'])
    expect(prs[0]).toMatchObject({ kg: 62.5, reps: 8 })
    expect(prs[0].e1rmKg).toBeGreaterThan(prs[0].prevE1rmKg)
  })

  it('treats a first session of an exercise as a baseline', () => {
    const swap = mkLog({ week: 2, day: 0, ex: { 0: { v: 1, sets: [['30', '10']] } } })
    expect(logPRs(swap, MINI, prior)).toEqual([])
  })

  it('ignores unticked sets while the workout is open', () => {
    const open = mkLog({ week: 2, day: 0, done: false, ex: { 0: { sets: [['80', '8', false]] } } })
    expect(logPRs(open, MINI, prior)).toEqual([])
    expect(logPRs({ ...open, done: true }, MINI, prior)).toHaveLength(1)
  })
})
