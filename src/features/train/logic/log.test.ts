import { describe, expect, it } from 'vitest'
import { MINI, at, mkLog } from '../../../lib/testing/fixtures'
import type { MemberSettings } from '../../../data/types'
import {
  addSet,
  dayProgress,
  doneAtFor,
  emptyLog,
  exerciseLog,
  finishLog,
  machineSuggestions,
  nextUp,
  openSetsWithReps,
  rememberMachine,
  removeSet,
  setField,
  setMachine,
  setVariant,
  tickSet,
  unfinishLog,
} from './log'

const upper = MINI.weeks[1].days[0]
const bench = upper.ex[0]
const NOW = 1_000_000
const fresh = () => emptyLog('stelios', MINI.id, 2, 0, 'kg')

describe('emptyLog / exerciseLog', () => {
  it('uses the deterministic id and the given unit', () => {
    const l = emptyLog('stelios', MINI.id, 2, 0, 'lb')
    expect(l.id).toBe('stelios__mini__w2d0')
    expect(l.unit).toBe('lb')
    expect(l.startedAt).toBeNull()
  })

  it('defaults to the main exercise, the remembered machine and the prescribed empty sets', () => {
    const x = exerciseLog(null, 0, bench, { 'Bench Press': 'Hammer' })
    expect(x.v).toBe(0)
    expect(x.m).toBe('Hammer')
    expect(x.sets).toHaveLength(2)
    expect(x.sets.every((s) => !s.ok && s.w === '' && s.r === '')).toBe(true)
  })

  it('pads stored entries up to the prescription and keeps an explicit empty machine', () => {
    const l = mkLog({ week: 2, day: 0, done: false, ex: { 0: { sets: [['50', '8']] } } })
    const x = exerciseLog(l, 0, bench, { 'Bench Press': 'Hammer' })
    expect(x.sets).toHaveLength(2)
    expect(x.sets[0].w).toBe('50')
    expect(x.m).toBe('')
  })
})

describe('setField', () => {
  it('stores the typed value and stamps startedAt once', () => {
    const a = setField(fresh(), 0, bench, 1, 'w', '57,5', {}, NOW)
    expect(a.ex['0'].sets[1].w).toBe('57,5')
    expect(a.startedAt).toBe(NOW)
    const b = setField(a, 0, bench, 1, 'r', '9', {}, NOW + 5000)
    expect(b.startedAt).toBe(NOW)
    expect(b.ex['0'].sets[1]).toMatchObject({ w: '57,5', r: '9', ok: false })
  })

  it('copies the remembered machine when the exercise entry is created', () => {
    const a = setField(fresh(), 0, bench, 0, 'w', '60', { 'Bench Press': 'Eleiko' }, NOW)
    expect(a.ex['0'].m).toBe('Eleiko')
  })

  it('does not restart a finished session', () => {
    const done = { ...fresh(), done: true, doneAt: NOW }
    expect(setField(done, 0, bench, 0, 'w', '60', {}, NOW).startedAt).toBeNull()
  })
})

describe('tickSet', () => {
  it('ticks a filled set and records the time', () => {
    const l = setField(setField(fresh(), 0, bench, 0, 'w', '60', {}, NOW), 0, bench, 0, 'r', '8', {}, NOW)
    const { log, result } = tickSet(l, 0, bench, 0, null, {}, NOW + 1)
    expect(result).toBe('ticked')
    expect(log.ex['0'].sets[0]).toEqual({ w: '60', r: '8', ok: true, at: NOW + 1 })
  })

  it("reuses last time's numbers on an empty set", () => {
    const { log, result } = tickSet(fresh(), 0, bench, 0, { w: '55', r: '10' }, {}, NOW)
    expect(result).toBe('ticked')
    expect(log.ex['0'].sets[0]).toMatchObject({ w: '55', r: '10', ok: true })
    expect(log.startedAt).toBe(NOW)
  })

  it('keeps what was typed and only fills the gaps', () => {
    const l = setField(fresh(), 0, bench, 0, 'w', '57.5', {}, NOW)
    const { log } = tickSet(l, 0, bench, 0, { w: '55', r: '10' }, {}, NOW)
    expect(log.ex['0'].sets[0]).toMatchObject({ w: '57.5', r: '10', ok: true })
  })

  it('asks for reps when there are none to reuse, filling the weight', () => {
    const { log, result } = tickSet(fresh(), 0, bench, 1, { w: '55', r: '' }, {}, NOW)
    expect(result).toBe('need-reps')
    expect(log.ex['0'].sets[1]).toMatchObject({ w: '55', r: '', ok: false })
  })

  it('asks for reps without touching the log when nothing can be filled', () => {
    const l = fresh()
    const out = tickSet(l, 0, bench, 0, null, {}, NOW)
    expect(out.result).toBe('need-reps')
    expect(out.log).toBe(l)
  })

  it('allows bodyweight sets (reps only)', () => {
    const { result, log } = tickSet(fresh(), 0, bench, 0, { w: '', r: '12' }, {}, NOW)
    expect(result).toBe('ticked')
    expect(log.ex['0'].sets[0]).toMatchObject({ w: '', r: '12', ok: true })
  })

  it('unticks a done set and keeps its numbers', () => {
    const a = tickSet(fresh(), 0, bench, 0, { w: '55', r: '10' }, {}, NOW).log
    const { log, result } = tickSet(a, 0, bench, 0, null, {}, NOW)
    expect(result).toBe('unticked')
    expect(log.ex['0'].sets[0]).toEqual({ w: '55', r: '10', ok: false, at: null })
  })

  it('rejects zero reps', () => {
    expect(tickSet(fresh(), 0, bench, 0, { w: '55', r: '0' }, {}, NOW).result).toBe('need-reps')
  })
})

describe('extra sets', () => {
  it('adds and removes extra sets but never prescribed ones', () => {
    const a = addSet(fresh(), 0, bench, {})
    expect(a.ex['0'].sets).toHaveLength(3)
    expect(a.startedAt).toBeNull()
    const b = removeSet(a, 0, bench, {})
    expect(b.ex['0'].sets).toHaveLength(2)
    expect(removeSet(b, 0, bench, {})).toBe(b)
  })
})

describe('variants and machines', () => {
  it('switching the exercise switches to its remembered machine', () => {
    const machines = { 'Bench Press': 'Eleiko', 'DB Press': 'Rogue' }
    const a = setField(fresh(), 0, bench, 0, 'w', '60', machines, NOW)
    const b = setVariant(a, 0, bench, 1, machines)
    expect(b.ex['0']).toMatchObject({ v: 1, m: 'Rogue' })
    expect(b.ex['0'].sets[0].w).toBe('60')
    expect(setVariant(b, 0, bench, 2, machines).ex['0'].m).toBe('')
  })

  it('sets a machine on the exercise', () => {
    expect(setMachine(fresh(), 0, bench, 'Technogym', {}).ex['0'].m).toBe('Technogym')
  })

  it('remembers and forgets machines per exercise name', () => {
    const s: MemberSettings = { unit: 'kg', machines: { Squat: 'Rogue' }, weightVisibility: 'exact' }
    expect(rememberMachine(s, 'Leg Press', ' Hammer ').machines).toEqual({ Squat: 'Rogue', 'Leg Press': 'Hammer' })
    expect(rememberMachine(s, 'Squat', '').machines).toEqual({})
    expect(s.machines).toEqual({ Squat: 'Rogue' })
  })

  it('suggests machines already used, most used first', () => {
    const s: MemberSettings = { unit: 'kg', machines: { Squat: 'Rogue' }, weightVisibility: 'exact' }
    const logs = [
      mkLog({ week: 1, day: 0, ex: { 0: { m: 'Hammer', sets: [] }, 1: { m: 'Hammer', sets: [] } } }),
      mkLog({ week: 1, day: 1, ex: { 0: { m: 'Technogym', sets: [] }, 1: { m: ' ', sets: [] } } }),
    ]
    expect(machineSuggestions(s, logs)).toEqual(['Hammer', 'Rogue', 'Technogym'])
  })
})

describe('doneAtFor / openSetsWithReps', () => {
  const day = (d: string, h: number) => at(d, h)
  const l = mkLog({ week: 2, day: 0, done: false, startedAt: day('2026-01-05', 18), ex: { 0: { sets: [['60', '8'], ['60', '7', false]] } } })
  l.ex['0'].sets[0].at = day('2026-01-05', 18) + 60_000

  it('uses now for today, the last set for an earlier day, else noon', () => {
    expect(doneAtFor('2026-01-09', l, day('2026-01-09', 20))).toBe(day('2026-01-09', 20))
    expect(doneAtFor('2026-01-05', l, day('2026-01-09', 20))).toBe(day('2026-01-05', 18) + 60_000)
    expect(doneAtFor('2026-01-06', l, day('2026-01-09', 20))).toBe(day('2026-01-06', 12))
  })

  it('counts unticked sets that have reps', () => {
    expect(openSetsWithReps(l)).toBe(1)
    expect(openSetsWithReps(null)).toBe(0)
  })
})

describe('finish', () => {
  it('marks done with feel and note, and back', () => {
    const a = finishLog(fresh(), { doneAt: NOW, feel: 4, note: 'good' })
    expect(a).toMatchObject({ done: true, doneAt: NOW, feel: 4, note: 'good' })
    expect(unfinishLog(a)).toMatchObject({ done: false, doneAt: null, feel: 4 })
  })
})

describe('dayProgress / nextUp', () => {
  const log = mkLog({
    week: 2,
    day: 0,
    done: false,
    ex: { 0: { sets: [['60', '8'], ['60', '7'], ['', '', false]] }, 1: { sets: [['40', '10'], ['', '', false]] } },
  })

  it('counts ticked sets against prescribed plus extra sets', () => {
    const p = dayProgress(log, upper)
    expect(p.exercises.map((x) => [x.done, x.total, x.complete])).toEqual([
      [2, 3, true],
      [1, 2, false],
    ])
    expect(p.setsDone).toBe(3)
    expect(p.setsTotal).toBe(5)
    expect(p.current).toBe(1)
  })

  it('is empty without a log', () => {
    const p = dayProgress(null, upper)
    expect(p.setsDone).toBe(0)
    expect(p.setsTotal).toBe(4)
    expect(p.current).toBe(0)
  })

  it('finds the next open set, then the next exercise, then done', () => {
    expect(nextUp(log, upper, 1, {})).toEqual({ kind: 'set', exercise: 1, set: 1, last: true })
    expect(nextUp(log, upper, 0, {})).toEqual({ kind: 'set', exercise: 0, set: 2, last: true })
    const onlyFirstDone = mkLog({ week: 2, day: 0, done: false, ex: { 0: { sets: [['60', '8'], ['60', '7']] } } })
    expect(nextUp(onlyFirstDone, upper, 0, {})).toEqual({ kind: 'exercise', exercise: 1 })
    const all = mkLog({ week: 2, day: 0, done: false, ex: { 0: { sets: [['60', '8'], ['60', '7']] }, 1: { sets: [['1', '1'], ['1', '1']] } } })
    expect(nextUp(all, upper, 1, {})).toEqual({ kind: 'done' })
  })

  it('wraps around to skipped exercises', () => {
    const l = mkLog({ week: 2, day: 0, done: false, ex: { 1: { sets: [['40', '10'], ['40', '10']] } } })
    expect(nextUp(l, upper, 1, {})).toEqual({ kind: 'exercise', exercise: 0 })
  })
})
