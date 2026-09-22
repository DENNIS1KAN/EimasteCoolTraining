import { describe, expect, it } from 'vitest'
import { DST_AUTUMN, DST_SPRING, MINI, mkLog } from '../testing/fixtures'
import { BTS_PROGRAM } from '../../data/programs'
import type { Program } from '../../data/types'
import { addDays } from '../dates'
import {
  nextWorkout,
  programWeekOn,
  programWorkouts,
  refKey,
  sameRef,
  scheduleStatus,
  scheduledDate,
  workoutOn,
  workoutsDueBy,
} from './schedule'

const BTS = BTS_PROGRAM
/** Monday before the spring DST switch, so week 1 -> week 2 crosses it. */
const START = '2026-03-23'

const doneLog = (week: number, day: number, program: Program = BTS) => mkLog({ program, week, day, done: true })

describe('refs', () => {
  it('refKey / sameRef', () => {
    expect(refKey({ week: 3, day: 1 })).toBe('w3d1')
    expect(sameRef({ week: 3, day: 1 }, { week: 3, day: 1 })).toBe(true)
    expect(sameRef({ week: 3, day: 1 }, { week: 1, day: 3 })).toBe(false)
    expect(sameRef(null, { week: 1, day: 0 })).toBe(false)
    expect(sameRef(undefined, undefined)).toBe(false)
  })
})

describe('programWorkouts', () => {
  it('lists every BTS workout in training order', () => {
    const all = programWorkouts(BTS)
    expect(all).toHaveLength(60)
    expect(all[0]).toEqual({ week: 1, day: 0 })
    expect(all[5]).toEqual({ week: 2, day: 0 })
    expect(all[59]).toEqual({ week: 12, day: 4 })
  })
})

describe('scheduledDate / workoutOn with the BTS pattern (Mon, Tue, Thu, Fri, Sat)', () => {
  it('places week 1 on the pattern and week 2 a week later, across DST', () => {
    expect(scheduledDate(BTS, START, { week: 1, day: 0 })).toBe('2026-03-23')
    expect(scheduledDate(BTS, START, { week: 1, day: 1 })).toBe('2026-03-24')
    expect(scheduledDate(BTS, START, { week: 1, day: 2 })).toBe('2026-03-26')
    expect(scheduledDate(BTS, START, { week: 1, day: 3 })).toBe('2026-03-27')
    expect(scheduledDate(BTS, START, { week: 1, day: 4 })).toBe('2026-03-28')
    expect(scheduledDate(BTS, START, { week: 2, day: 0 })).toBe('2026-03-30')
    expect(scheduledDate(BTS, START, { week: 12, day: 4 })).toBe('2026-06-13')
  })

  it('rest days and dates outside the program have no workout', () => {
    expect(workoutOn(BTS, START, '2026-03-25')).toBeNull() // Wednesday
    expect(workoutOn(BTS, START, DST_SPRING)).toBeNull() // Sunday
    expect(workoutOn(BTS, START, '2026-03-22')).toBeNull() // before the start
    expect(workoutOn(BTS, START, '2026-06-15')).toBeNull() // week 13
  })

  it('workoutOn is the inverse of scheduledDate for all 60 workouts', () => {
    for (const r of programWorkouts(BTS)) expect(workoutOn(BTS, START, scheduledDate(BTS, START, r))).toEqual(r)
  })

  it('a start on a non-Monday shifts the whole pattern (Wednesday start across the autumn switch)', () => {
    const start = '2026-10-21' // Wednesday
    expect(scheduledDate(BTS, start, { week: 1, day: 2 })).toBe('2026-10-24')
    expect(scheduledDate(BTS, start, { week: 1, day: 3 })).toBe(DST_AUTUMN)
    expect(workoutOn(BTS, start, DST_AUTUMN)).toEqual({ week: 1, day: 3 })
    expect(workoutOn(BTS, start, '2026-10-23')).toBeNull() // slot 2 is rest
    expect(workoutOn(BTS, start, '2026-10-28')).toEqual({ week: 2, day: 0 })
  })
})

describe('programs without a complete schedule', () => {
  const noSchedule: Program = { ...MINI, id: 'nosched', schedule: [] }
  const partial: Program = { ...MINI, id: 'partial', schedule: [0, null, 1] }

  it('spreads days evenly over the week when the schedule is empty', () => {
    expect(programWorkouts(noSchedule).slice(0, 3).map((r) => scheduledDate(noSchedule, START, r))).toEqual([
      '2026-03-23',
      '2026-03-25',
      '2026-03-27',
    ])
  })

  it('workoutOn agrees with scheduledDate when the schedule is empty or partial', () => {
    for (const p of [noSchedule, partial]) {
      for (const r of programWorkouts(p)) expect(workoutOn(p, START, scheduledDate(p, START, r))).toEqual(r)
      expect(workoutOn(p, START, '2026-03-24')).toBeNull()
    }
  })

  it('ignores schedule slots pointing at days the week does not have', () => {
    const short: Program = { ...MINI, id: 'short', weeks: [MINI.weeks[0], { ...MINI.weeks[1], days: MINI.weeks[1].days.slice(0, 1) }] }
    expect(workoutOn(short, START, '2026-04-01')).toBeNull() // week 2 Wednesday -> day 1, which week 2 lacks
    expect(workoutOn(short, START, '2026-03-30')).toEqual({ week: 2, day: 0 })
  })
})

describe('workoutsDueBy / programWeekOn', () => {
  it('counts scheduled workouts on or before a date', () => {
    expect(workoutsDueBy(BTS, START, '2026-03-22')).toBe(0)
    expect(workoutsDueBy(BTS, START, START)).toBe(1)
    expect(workoutsDueBy(BTS, START, '2026-03-25')).toBe(2)
    expect(workoutsDueBy(BTS, START, DST_SPRING)).toBe(5)
    expect(workoutsDueBy(BTS, START, '2026-03-30')).toBe(6)
    expect(workoutsDueBy(BTS, START, '2026-06-13')).toBe(60)
    expect(workoutsDueBy(BTS, START, '2027-01-01')).toBe(60)
  })

  it('program week is 0 before the start and capped at the last week', () => {
    expect(programWeekOn(BTS, START, '2026-03-22')).toBe(0)
    expect(programWeekOn(BTS, START, START)).toBe(1)
    expect(programWeekOn(BTS, START, DST_SPRING)).toBe(1)
    expect(programWeekOn(BTS, START, '2026-03-30')).toBe(2)
    expect(programWeekOn(BTS, START, '2027-01-01')).toBe(12)
  })
})

describe('nextWorkout', () => {
  it('is the first workout in training order that is not done', () => {
    expect(nextWorkout(BTS, [])).toEqual({ week: 1, day: 0 })
    expect(nextWorkout(BTS, [doneLog(1, 0), doneLog(1, 1)])).toEqual({ week: 1, day: 2 })
  })

  it('fills gaps left by out-of-order training', () => {
    expect(nextWorkout(BTS, [doneLog(1, 0), doneLog(1, 2), doneLog(2, 0)])).toEqual({ week: 1, day: 1 })
  })

  it('ignores unfinished logs and logs of other programs', () => {
    const started = mkLog({ program: BTS, week: 1, day: 0, done: false, ex: { 0: { sets: [['60', '8']] } } })
    expect(nextWorkout(BTS, [started, doneLog(1, 0, MINI)])).toEqual({ week: 1, day: 0 })
  })

  it('is null when everything is done', () => {
    expect(nextWorkout(MINI, programWorkouts(MINI).map((r) => doneLog(r.week, r.day, MINI)))).toBeNull()
  })
})

describe('scheduleStatus', () => {
  it('without a start date nothing is due', () => {
    const s = scheduleStatus(BTS, null, [doneLog(1, 0)], '2026-03-25')
    expect(s).toMatchObject({ started: false, done: 1, dueBeforeToday: 0, behindBy: 0, aheadBy: 0, consistency: null, today: null })
  })

  it('before the start date: not started, early workouts count as ahead', () => {
    const s = scheduleStatus(BTS, START, [doneLog(1, 0)], '2026-03-20')
    expect(s).toMatchObject({ started: false, dueBeforeToday: 0, aheadBy: 1, behindBy: 0, consistency: null })
  })

  it('on day one, today is not held against you until it is over', () => {
    const s = scheduleStatus(BTS, START, [], START)
    expect(s).toMatchObject({ started: true, dueBeforeToday: 0, today: { week: 1, day: 0 }, behindBy: 0, consistency: null })
    const after = scheduleStatus(BTS, START, [doneLog(1, 0)], START)
    expect(after).toMatchObject({ done: 1, consistency: 1, aheadBy: 0, behindBy: 0 })
  })

  it('midweek with a missed session', () => {
    const s = scheduleStatus(BTS, START, [doneLog(1, 0)], '2026-03-26') // Thursday: Mon + Tue were due
    expect(s).toMatchObject({ dueBeforeToday: 2, today: { week: 1, day: 2 }, done: 1, behindBy: 1, aheadBy: 0, consistency: 0.5 })
  })

  it('on a rest day there is no workout today', () => {
    expect(scheduleStatus(BTS, START, [], '2026-03-25').today).toBeNull()
  })

  it('training ahead of schedule caps consistency at 100%', () => {
    const logs = [doneLog(1, 0), doneLog(1, 1), doneLog(1, 2), doneLog(1, 3)]
    const s = scheduleStatus(BTS, START, logs, '2026-03-24')
    expect(s).toMatchObject({ dueBeforeToday: 1, done: 4, aheadBy: 2, behindBy: 0, consistency: 1 })
  })

  it('counts only finished logs of this program', () => {
    const logs = [doneLog(1, 0), doneLog(1, 1, MINI), mkLog({ program: BTS, week: 1, day: 1, done: false })]
    expect(scheduleStatus(BTS, START, logs, '2026-03-25').done).toBe(1)
  })

  it('after the program ends everything is due and finishing all marks it finished', () => {
    const all = programWorkouts(MINI).map((r) => doneLog(r.week, r.day, MINI))
    const s = scheduleStatus(MINI, START, all, addDays(START, 30))
    expect(s).toMatchObject({ dueBeforeToday: 6, done: 6, finished: true, behindBy: 0, consistency: 1 })
    expect(scheduleStatus(MINI, START, all.slice(0, 3), addDays(START, 30))).toMatchObject({ finished: false, behindBy: 3, consistency: 0.5 })
  })
})
