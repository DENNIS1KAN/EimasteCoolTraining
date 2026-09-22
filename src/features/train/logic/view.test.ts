import { describe, expect, it } from 'vitest'
import { MINI, at, mkLog } from '../../../lib/testing/fixtures'
import { workoutView } from './view'

describe('workoutView', () => {
  const w1 = mkLog({ week: 1, day: 0, doneAt: at('2026-01-05'), ex: { 0: { sets: [['60', '8']] }, 1: { sets: [['50', '10']] } } })
  const w2 = mkLog({
    week: 2,
    day: 0,
    doneAt: at('2026-01-12'),
    ex: { 0: { m: 'Eleiko', sets: [['60', '8'], ['65', '8'], ['60', '6']] }, 1: { v: 0, sets: [['50', '9']] } },
  })

  it('lists every exercise with its counted sets, extra sets and machine', () => {
    const v = workoutView(w2, MINI, 2, 0, [w1, w2])
    expect(v.map((x) => x.name)).toEqual(['Bench Press', 'Row'])
    expect(v[0].machine).toBe('Eleiko')
    expect(v[0].sets.map((s) => [s.kg, s.reps, s.extra])).toEqual([
      [60, 8, false],
      [65, 8, false],
      [60, 6, true],
    ])
  })

  it('marks the best set of an exercise that set a PR in this session', () => {
    const v = workoutView(w2, MINI, 2, 0, [w1, w2])
    expect(v[0].sets.map((s) => s.pr)).toEqual([false, true, false])
    expect(v[1].sets.every((s) => !s.pr)).toBe(true)
  })

  it('does not call the first session a PR', () => {
    expect(workoutView(w1, MINI, 1, 0, [w1, w2]).flatMap((x) => x.sets).some((s) => s.pr)).toBe(false)
  })

  it('marks skipped exercises and handles a missing log', () => {
    const partial = mkLog({ week: 2, day: 1, done: false, ex: { 0: { sets: [['100', '5', false]] } } })
    const v = workoutView(partial, MINI, 2, 1, [partial])
    expect(v.map((x) => x.skipped)).toEqual([true, true])
    expect(workoutView(null, MINI, 2, 1, []).every((x) => x.skipped)).toBe(true)
    expect(workoutView(null, MINI, 9, 0, [])).toEqual([])
  })

  it('names substitutions', () => {
    const swap = mkLog({ week: 2, day: 0, ex: { 0: { v: 1, sets: [['24', '10']] } } })
    expect(workoutView(swap, MINI, 2, 0, [swap])[0]).toMatchObject({ name: 'DB Press', v: 1 })
  })
})
