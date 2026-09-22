import { describe, expect, it } from 'vitest'
import { DST_SPRING, MINI, at, mkLog } from '../testing/fixtures'
import type { SetLog } from '../../data/types'
import {
  bestE1rmByExercise,
  e1rm,
  exerciseHistory,
  isCountedSet,
  isLogStarted,
  isPRSet,
  logDate,
  logTime,
  performedExerciseNames,
  performedExercises,
  personalRecords,
  sessionSummary,
  setKg,
  setReps,
  strengthGain,
  type ProgramMap,
} from './lifts'

const programs: ProgramMap = { [MINI.id]: MINI }
const set = (w: string, r: string, ok = true): SetLog => ({ w, r, ok })

/** A done upper-day (week w, day 0) with bench sets, finished on `date`. */
const bench = (week: number, date: string, sets: [string, string][], extra: Parameters<typeof mkLog>[0]['ex'] = {}) =>
  mkLog({ week, day: 0, doneAt: at(date), ex: { 0: { sets }, ...extra } })

describe('e1rm', () => {
  it('Epley, with a single rep being the lift itself', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(100, 10)).toBeCloseTo(133.333, 3)
    expect(e1rm(60, 5)).toBeCloseTo(70, 10)
  })

  it('caps reps at 15', () => {
    expect(e1rm(100, 30)).toBe(e1rm(100, 15))
    expect(e1rm(100, 15)).toBe(150)
  })

  it('is 0 for missing or nonsense input', () => {
    expect(e1rm(0, 5)).toBe(0)
    expect(e1rm(100, 0)).toBe(0)
    expect(e1rm(-20, 5)).toBe(0)
    expect(e1rm(Number.NaN, 5)).toBe(0)
    expect(e1rm(100, Number.NaN)).toBe(0)
  })
})

describe('setKg / setReps / isCountedSet', () => {
  it('parses weights as typed, including decimal commas and pounds', () => {
    expect(setKg(set('57,5', '8'), 'kg')).toBe(57.5)
    expect(setKg(set('225', '5'), 'lb')).toBeCloseTo(102.058, 3)
    expect(setKg(set('0', '10'), 'kg')).toBe(0)
    expect(setKg(set('', '10'), 'kg')).toBeNull()
    expect(setKg(set('-5', '10'), 'kg')).toBeNull()
    expect(setKg(set('heavy', '10'), 'kg')).toBeNull()
  })

  it('reps must be a positive whole number after rounding', () => {
    expect(setReps(set('60', '8'))).toBe(8)
    expect(setReps(set('60', '8,6'))).toBe(9)
    expect(setReps(set('60', ' 10 '))).toBe(10)
    expect(setReps(set('60', ''))).toBeNull()
    expect(setReps(set('60', '0'))).toBeNull()
    expect(setReps(set('60', '-3'))).toBeNull()
  })

  it('a fraction that rounds to 0 reps is not a set', () => {
    expect(setReps(set('60', '0.4'))).toBeNull()
    expect(isCountedSet(set('60', '0.4'), true)).toBe(false)
  })

  it('a set counts when ticked, or when the workout is done and it has reps', () => {
    expect(isCountedSet(set('60', '8', true), false)).toBe(true)
    expect(isCountedSet(set('60', '8', false), false)).toBe(false)
    expect(isCountedSet(set('60', '8', false), true)).toBe(true)
    expect(isCountedSet(set('60', '', true), true)).toBe(false)
    expect(isCountedSet(set('', '12', true), false)).toBe(true) // bodyweight
  })
})

describe('logTime / logDate / isLogStarted', () => {
  it('prefers finish, then start, then last edit', () => {
    const base = mkLog({ week: 1, day: 0, done: false, doneAt: null, updatedAt: 3 })
    expect(logTime(base)).toBe(3)
    expect(logTime({ ...base, startedAt: 2 })).toBe(2)
    expect(logTime({ ...base, startedAt: 2, doneAt: 1 })).toBe(1)
  })

  it('logDate is the local calendar date, also just after midnight on a DST day', () => {
    expect(logDate(mkLog({ week: 1, day: 0, doneAt: at(DST_SPRING, 0, 30) }))).toBe(DST_SPRING)
    expect(logDate(mkLog({ week: 1, day: 0, doneAt: at('2026-03-28', 23, 59) }))).toBe('2026-03-28')
  })

  it('a log is started once any set counts', () => {
    expect(isLogStarted(mkLog({ week: 1, day: 0, done: false, ex: {} }))).toBe(false)
    expect(isLogStarted(mkLog({ week: 1, day: 0, done: false, ex: { 0: { sets: [['60', '8', false]] } } }))).toBe(false)
    expect(isLogStarted(mkLog({ week: 1, day: 0, done: false, ex: { 0: { sets: [['60', '', true]] } } }))).toBe(false)
    expect(isLogStarted(mkLog({ week: 1, day: 0, done: false, ex: { 0: { sets: [['60', '8', true]] } } }))).toBe(true)
    expect(isLogStarted(mkLog({ week: 1, day: 0, done: true, ex: { 0: { sets: [['60', '8', false]] } } }))).toBe(true)
  })
})

describe('performedExercises', () => {
  it('returns counted sets per exercise with volume and best e1RM', () => {
    const l = mkLog({ week: 1, day: 0, ex: { 0: { sets: [['60', '10'], ['62,5', '8'], ['70', '', true]] }, 1: { sets: [['50', '12', false]] } } })
    const [bp, row] = performedExercises(l, MINI)
    expect(bp).toMatchObject({ index: 0, name: 'Bench Press', programName: 'Bench Press', prescribedSets: 2, volumeKg: 1100 })
    expect(bp.sets).toHaveLength(2)
    expect(bp.bestE1rmKg).toBeCloseTo(80, 5)
    // unticked sets count once the workout is marked done
    expect(row).toMatchObject({ index: 1, name: 'Row', volumeKg: 600 })
  })

  it('reports the substitution actually performed (v 1/2) under its own name', () => {
    const l = mkLog({ week: 1, day: 0, ex: { 0: { v: 2, m: 'Hammer', sets: [['80', '10']] } } })
    expect(performedExercises(l, MINI)[0]).toMatchObject({ name: 'Machine Press', programName: 'Bench Press', machine: 'Hammer' })
  })

  it('falls back to the main name when the variant has no substitution', () => {
    const l = mkLog({ week: 1, day: 0, ex: { 1: { v: 1, sets: [['50', '10']] } } })
    expect(performedExercises(l, MINI)[0].name).toBe('Row')
  })

  it('converts pound logs to kg', () => {
    const l = mkLog({ week: 1, day: 0, unit: 'lb', ex: { 0: { sets: [['135', '10']] } } })
    const [bp] = performedExercises(l, MINI)
    expect(bp.sets[0].kg).toBeCloseTo(61.235, 3)
    expect(bp.volumeKg).toBeCloseTo(612.35, 1)
  })

  it('keeps sets beyond the prescribed count and bodyweight sets', () => {
    const l = mkLog({ week: 1, day: 2, ex: { 0: { sets: [['', '10'], ['', '8'], ['10', '6']] } } })
    const [pu] = performedExercises(l, MINI)
    expect(pu.sets.map((s) => s.kg)).toEqual([null, null, 10])
    expect(pu.prescribedSets).toBe(2)
    expect(pu.volumeKg).toBe(60)
    expect(pu.sets[0].e1rmKg).toBe(0)
  })

  it('skips exercises with no counted sets, unknown indices, unknown days and unknown programs', () => {
    const l = mkLog({ week: 1, day: 0, done: false, ex: { 0: { sets: [['60', '8', false]] }, 7: { sets: [['60', '8']] } } })
    expect(performedExercises(l, MINI)).toEqual([])
    expect(performedExercises(mkLog({ week: 9, day: 0, ex: { 0: { sets: [['60', '8']] } } }), MINI)).toEqual([])
    expect(performedExercises(mkLog({ week: 1, day: 5, ex: { 0: { sets: [['60', '8']] } } }), MINI)).toEqual([])
    expect(performedExercises(mkLog({ week: 1, day: 0, ex: { 0: { sets: [['60', '8']] } } }), undefined)).toEqual([])
  })
})

describe('sessionSummary', () => {
  it('totals sets, reps, volume and the prescription', () => {
    const l = mkLog({
      week: 1,
      day: 0,
      startedAt: at('2026-01-05', 18, 0),
      doneAt: at('2026-01-05', 19, 5),
      ex: { 0: { sets: [['60', '10'], ['60', '8']] }, 1: { sets: [['50', '12'], ['', '', true]] } },
    })
    expect(sessionSummary(l, MINI)).toEqual({ exercises: 2, setsDone: 3, setsPrescribed: 4, reps: 30, volumeKg: 1680, durationMs: 65 * 60_000 })
  })

  it('derives the duration from set tick times when start/finish are missing', () => {
    const l = mkLog({ week: 1, day: 0, done: false, doneAt: null, ex: { 0: { sets: [['60', '10']] } } })
    l.ex['0'].sets = [
      { w: '60', r: '10', ok: true, at: 1_000_000 },
      { w: '60', r: '10', ok: true, at: 1_600_000 },
    ]
    expect(sessionSummary(l, MINI).durationMs).toBe(600_000)
    l.ex['0'].sets = [{ w: '60', r: '10', ok: true, at: 1_000_000 }]
    expect(sessionSummary(l, MINI).durationMs).toBeNull()
  })

  it('is all zero for an empty log or an unknown program', () => {
    const empty = mkLog({ week: 1, day: 0, done: false, doneAt: null })
    expect(sessionSummary(empty, MINI)).toEqual({ exercises: 0, setsDone: 0, setsPrescribed: 4, reps: 0, volumeKg: 0, durationMs: null })
    expect(sessionSummary(empty, undefined).setsPrescribed).toBe(0)
  })
})

describe('exerciseHistory / performedExerciseNames', () => {
  const logs = [
    bench(2, '2026-01-12', [['65', '8'], ['70', '6']]),
    bench(1, '2026-01-05', [['60', '8'], ['60', '8']]),
    mkLog({ week: 2, day: 1, doneAt: at('2026-01-14'), ex: { 0: { v: 1, sets: [['100', '10']] } } }),
    mkLog({ week: 1, day: 1, doneAt: at('2026-01-07'), ex: { 0: { sets: [['80', '5']] } } }),
  ]

  it('is chronological even when logs arrive out of order', () => {
    const h = exerciseHistory(logs, programs, 'Bench Press')
    expect(h.map((p) => p.date)).toEqual(['2026-01-05', '2026-01-12'])
    expect(h[1]).toMatchObject({ week: 2, day: 0, topSet: { kg: 70, reps: 6 }, volumeKg: 940 })
  })

  it('breaks top-set ties on weight by reps', () => {
    const h = exerciseHistory([bench(1, '2026-01-05', [['60', '6'], ['60', '9'], ['60', '8']])], programs, 'Bench Press')
    expect(h[0].topSet).toEqual({ kg: 60, reps: 9 })
  })

  it('a substitution has its own history', () => {
    expect(exerciseHistory(logs, programs, 'Squat').map((p) => p.date)).toEqual(['2026-01-07'])
    expect(exerciseHistory(logs, programs, 'Hack Squat').map((p) => p.date)).toEqual(['2026-01-14'])
  })

  it('lists performed names by frequency, then alphabetically', () => {
    expect(performedExerciseNames(logs, programs)).toEqual(['Bench Press', 'Hack Squat', 'Squat'])
    expect(performedExerciseNames([], programs)).toEqual([])
  })
})

describe('personalRecords', () => {
  it('the first session of an exercise is a baseline, not a PR', () => {
    expect(personalRecords([bench(1, '2026-01-05', [['100', '5']])], programs)).toEqual([])
  })

  it('a later session beating every earlier best is a PR, with the previous best', () => {
    const prs = personalRecords([bench(1, '2026-01-05', [['100', '5']]), bench(2, '2026-01-12', [['90', '8'], ['102,5', '5']])], programs)
    expect(prs).toHaveLength(1)
    expect(prs[0]).toMatchObject({ exercise: 'Bench Press', date: '2026-01-12', kg: 102.5, reps: 5, logId: 'stelios__mini__w2d0' })
    expect(prs[0].prevE1rmKg).toBeCloseTo(116.667, 3)
    expect(prs[0].e1rmKg).toBeCloseTo(119.583, 3)
  })

  it('must beat the best ever, not just the previous session', () => {
    const logs = [
      bench(1, '2026-01-05', [['100', '5']]),
      bench(2, '2026-01-12', [['90', '5']]),
      mkLog({ week: 1, day: 0, member: 'stelios', doneAt: at('2026-01-19'), ex: { 0: { sets: [['95', '5']] } } }),
    ]
    expect(personalRecords(logs, programs)).toEqual([])
  })

  it('ignores improvements within rounding noise (0.25 kg e1RM)', () => {
    // 100 x 5 = 116.667; 100.2 x 5 = 116.9 (+0.23)
    expect(personalRecords([bench(1, '2026-01-05', [['100', '5']]), bench(2, '2026-01-12', [['100,2', '5']])], programs)).toEqual([])
    expect(personalRecords([bench(1, '2026-01-05', [['100', '5']]), bench(2, '2026-01-12', [['100', '5']])], programs)).toEqual([])
  })

  it('orders by time, not by input order or program week', () => {
    const later = bench(1, '2026-02-01', [['110', '5']]) // week 1 redone later
    const earlier = bench(2, '2026-01-12', [['100', '5']])
    const prs = personalRecords([later, earlier], programs)
    expect(prs.map((p) => p.date)).toEqual(['2026-02-01'])
  })

  it('treats a substitution as a different exercise', () => {
    const logs = [bench(1, '2026-01-05', [['100', '5']]), mkLog({ week: 2, day: 0, doneAt: at('2026-01-12'), ex: { 0: { v: 1, sets: [['40', '10']] } } })]
    expect(personalRecords(logs, programs)).toEqual([])
    const more = [...logs, mkLog({ week: 1, day: 0, member: 'stelios', doneAt: at('2026-01-19'), ex: { 0: { v: 1, sets: [['45', '10']] } } })]
    expect(personalRecords(more, programs).map((p) => p.exercise)).toEqual(['DB Press'])
  })

  it('compares pound logs in kg', () => {
    const prs = personalRecords([bench(1, '2026-01-05', [['100', '5']]), { ...bench(2, '2026-01-12', [['225', '5']]), unit: 'lb' as const }], programs)
    expect(prs).toHaveLength(1)
    expect(prs[0].kg).toBeCloseTo(102.058, 3)
  })

  it('counts ticked sets of a workout that is started but not finished', () => {
    const live = mkLog({ week: 2, day: 0, done: false, doneAt: null, startedAt: at('2026-01-12'), ex: { 0: { sets: [['110', '5', true], ['200', '5', false]] } } })
    const prs = personalRecords([bench(1, '2026-01-05', [['100', '5']]), live], programs)
    expect(prs).toHaveLength(1)
    expect(prs[0].kg).toBe(110)
  })

  it('bodyweight-only sessions do not become the baseline', () => {
    const logs = [
      mkLog({ week: 1, day: 2, doneAt: at('2026-01-09'), ex: { 0: { sets: [['', '10']] } } }),
      mkLog({ week: 2, day: 2, doneAt: at('2026-01-16'), ex: { 0: { sets: [['5', '8']] } } }),
    ]
    expect(personalRecords(logs, programs)).toEqual([])
  })
})

describe('bestE1rmByExercise / isPRSet', () => {
  const logs = [bench(1, '2026-01-05', [['100', '5']]), bench(2, '2026-01-12', [['105', '5']])]

  it('takes the best per exercise, optionally excluding the log being edited', () => {
    expect(bestE1rmByExercise(logs, programs).get('Bench Press')).toBeCloseTo(122.5, 5)
    expect(bestE1rmByExercise(logs, programs, logs[1].id).get('Bench Press')).toBeCloseTo(116.667, 3)
    expect(bestE1rmByExercise([], programs).size).toBe(0)
  })

  it('isPRSet needs a prior best and a clear improvement', () => {
    expect(isPRSet(set('200', '5'), 'kg', undefined)).toBe(false)
    expect(isPRSet(set('200', '5'), 'kg', 0)).toBe(false)
    expect(isPRSet(set('105', '5'), 'kg', 116.667)).toBe(true)
    expect(isPRSet(set('100', '5'), 'kg', 116.667)).toBe(false)
    expect(isPRSet(set('100,2', '5'), 'kg', 116.667)).toBe(false)
    expect(isPRSet(set('', '5'), 'kg', 50)).toBe(false)
    expect(isPRSet(set('100', ''), 'kg', 50)).toBe(false)
    expect(isPRSet(set('250', '5'), 'lb', 116.667)).toBe(true) // 113.4 kg x 5
  })
})

describe('strengthGain', () => {
  it('is null until an exercise has two sessions', () => {
    expect(strengthGain([], programs)).toBeNull()
    expect(strengthGain([bench(1, '2026-01-05', [['100', '5']])], programs)).toBeNull()
  })

  it('averages best-ever vs first-session gains over exercises with 2+ sessions', () => {
    const logs = [
      bench(1, '2026-01-05', [['100', '1']]),
      bench(2, '2026-01-12', [['110', '1']]),
      mkLog({ week: 1, day: 1, doneAt: at('2026-01-07'), ex: { 0: { sets: [['100', '1']] } } }),
      mkLog({ week: 2, day: 1, doneAt: at('2026-01-14'), ex: { 0: { sets: [['130', '1']] } } }),
      mkLog({ week: 1, day: 2, doneAt: at('2026-01-09'), ex: { 1: { sets: [['10', '1']] } } }), // one session only
    ]
    const g = strengthGain(logs, programs)
    expect(g?.exercises).toBe(2)
    expect(g?.pct).toBeCloseTo(0.2, 10)
  })

  it('uses the first session in time as the baseline; a later dip gives 0, never a negative gain', () => {
    const g = strengthGain([bench(2, '2026-01-12', [['90', '1']]), bench(1, '2026-01-05', [['100', '1']])], programs)
    expect(g?.pct).toBeCloseTo(0, 10)
  })
})
