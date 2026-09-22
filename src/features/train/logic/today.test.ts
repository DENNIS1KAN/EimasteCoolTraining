import { describe, expect, it } from 'vitest'
import { MINI, at, mkLog } from '../../../lib/testing/fixtures'
import { heroWeek, liveLog, nextTrainingDate, todayState } from './today'

// MINI trains Mon / Wed / Fri. Start: Monday 2026-01-05.
const START = '2026-01-05'
const base = { program: MINI, member: { programStart: START } }

describe('todayState', () => {
  it('has no program', () => {
    expect(todayState({ ...base, program: null, logs: [], today: START, now: at(START, 9) }).kind).toBe('no-program')
  })

  it('asks for a start date', () => {
    const s = todayState({ ...base, member: { programStart: null }, logs: [], today: START, now: at(START, 9) })
    expect(s).toEqual({ kind: 'not-started', next: { week: 1, day: 0 } })
  })

  it('counts down to a future start', () => {
    const s = todayState({ ...base, member: { programStart: '2026-01-12' }, logs: [], today: '2026-01-09', now: at('2026-01-09', 9) })
    expect(s).toMatchObject({ kind: 'starts-soon', start: '2026-01-12', inDays: 3 })
  })

  it("trains today's scheduled workout", () => {
    const s = todayState({ ...base, logs: [], today: START, now: at(START, 9) })
    expect(s).toEqual({ kind: 'train', ref: { week: 1, day: 0 }, scheduledToday: true, behindBy: 0 })
  })

  it('shows a rest day with the next workout and its date', () => {
    const logs = [mkLog({ week: 1, day: 0, doneAt: at(START, 18) })]
    const s = todayState({ ...base, logs, today: '2026-01-06', now: at('2026-01-06', 9) })
    expect(s).toEqual({ kind: 'rest', next: { week: 1, day: 1 }, nextDate: '2026-01-07' })
  })

  it('asks to catch up when behind (on the first missed workout)', () => {
    const s = todayState({ ...base, logs: [], today: '2026-01-08', now: at('2026-01-08', 9) })
    expect(s).toEqual({ kind: 'train', ref: { week: 1, day: 0 }, scheduledToday: false, behindBy: 2 })
  })

  it('continues a session in progress', () => {
    const live = mkLog({ week: 1, day: 0, done: false, startedAt: at(START, 18), updatedAt: at(START, 18, 30), ex: { 0: { sets: [['50', '8']] } } })
    const s = todayState({ ...base, logs: [live], today: START, now: at(START, 19) })
    expect(s).toMatchObject({ kind: 'in-progress', ref: { week: 1, day: 0 } })
  })

  it('shows today as done with the next workout', () => {
    const done = mkLog({ week: 1, day: 0, doneAt: at(START, 7), startedAt: at(START, 6) })
    const s = todayState({ ...base, logs: [done], today: START, now: at(START, 9) })
    expect(s).toMatchObject({ kind: 'done-today', ref: { week: 1, day: 0 }, next: { week: 1, day: 1 }, nextDate: '2026-01-07' })
  })

  it('is complete when every workout is done', () => {
    const logs = [0, 1, 2].flatMap((d) => [mkLog({ week: 1, day: d, doneAt: at('2026-01-02') }), mkLog({ week: 2, day: d, doneAt: at('2026-01-02') })])
    expect(todayState({ ...base, logs, today: '2026-01-20', now: at('2026-01-20', 9) })).toEqual({ kind: 'complete', done: 6 })
  })

  it('ignores logs of other programs', () => {
    const other = { ...mkLog({ week: 1, day: 0 }), programId: 'other' }
    expect(todayState({ ...base, logs: [other], today: START, now: at(START, 9) }).kind).toBe('train')
  })
})

describe('liveLog', () => {
  it('drops sessions left open for more than 12 hours', () => {
    const l = mkLog({ week: 1, day: 0, done: false, startedAt: at(START, 6), updatedAt: at(START, 7) })
    expect(liveLog([l], at(START, 18))).toBe(l)
    expect(liveLog([l], at('2026-01-06', 9))).toBeNull()
  })
  it('needs a start or a counted set', () => {
    const idle = mkLog({ week: 1, day: 0, done: false, updatedAt: at(START, 7), ex: { 0: { m: 'Hammer', sets: [] } } })
    expect(liveLog([idle], at(START, 8))).toBeNull()
  })
})

describe('nextTrainingDate / heroWeek', () => {
  it('uses the scheduled date, or the next training day when that date has passed', () => {
    expect(nextTrainingDate(MINI, START, { week: 1, day: 2 }, '2026-01-06')).toBe('2026-01-09')
    // week 2 day 0 was scheduled Mon 12 Jan; from Tue 13 Jan the next training day is Wed 14 Jan
    expect(nextTrainingDate(MINI, START, { week: 2, day: 0 }, '2026-01-13')).toBe('2026-01-14')
  })

  it('shows the calendar week once started', () => {
    expect(heroWeek(MINI, START, '2026-01-13', null)).toBe(2)
    expect(heroWeek(MINI, null, '2026-01-13', { week: 1, day: 2 })).toBe(1)
  })
})
