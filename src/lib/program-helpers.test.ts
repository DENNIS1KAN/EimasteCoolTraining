import { describe, expect, it } from 'vitest'
import { MINI } from './testing/fixtures'
import {
  BTS_PROGRAM,
  dayFocus,
  dayShortName,
  daysPerWeek,
  exerciseName,
  exerciseVideo,
  restSeconds,
  totalWorkouts,
  warmupSetCount,
  workingSets,
} from '../data/programs'
import type { ProgramExercise } from '../data/types'

const ex = (p: Partial<ProgramExercise>): ProgramExercise => ({ n: 'Squat', t: 'N/A', w: '', s: '', r: '', e: '', l: '', rest: '', ...p })

describe('program helpers (src/data/programs)', () => {
  it('day names', () => {
    expect(dayShortName({ name: 'Upper (Strength Focus)' })).toBe('Upper')
    expect(dayFocus({ name: 'Upper (Strength Focus)' })).toBe('Strength Focus')
    expect(dayShortName({ name: 'Full Body' })).toBe('Full Body')
    expect(dayFocus({ name: 'Full Body' })).toBe('')
  })

  it('exerciseName / exerciseVideo pick the variant, falling back to the main exercise', () => {
    const e = ex({ s1: 'Hack Squat', s2: '', v: 'main.mp4', v1: 'hack.mp4' })
    expect([0, 1, 2, undefined].map((v) => exerciseName(e, v))).toEqual(['Squat', 'Hack Squat', 'Squat', 'Squat'])
    expect([0, 1, 2].map((v) => exerciseVideo(e, v))).toEqual(['main.mp4', 'hack.mp4', undefined])
    expect(exerciseVideo(ex({ v: '' }), 0)).toBeUndefined()
  })

  it('workingSets uses the lower bound and is at least 1', () => {
    expect(workingSets(ex({ s: '3' }))).toBe(3)
    expect(workingSets(ex({ s: '2-3' }))).toBe(2)
    expect(workingSets(ex({ s: '' }))).toBe(1)
    expect(workingSets(ex({ s: '0' }))).toBe(1)
  })

  it('warmupSetCount uses the upper bound, capped 1..4', () => {
    expect(warmupSetCount(ex({ w: '2-3' }))).toBe(3)
    expect(warmupSetCount(ex({ w: '2-4' }))).toBe(4)
    expect(warmupSetCount(ex({ w: '6' }))).toBe(4)
    expect(warmupSetCount(ex({ w: '' }))).toBe(1)
    expect(warmupSetCount(ex({ w: '0' }))).toBe(1) // judgement call: always suggest one warm-up set
  })

  it('restSeconds reads the BTS strings as the lower bound in minutes', () => {
    expect(restSeconds('3-5 min')).toBe(180)
    expect(restSeconds('1-2 min')).toBe(60)
    expect(restSeconds('2-3 min')).toBe(120)
    expect(restSeconds('1.5 min')).toBe(90)
    expect(restSeconds('1,5 min')).toBe(90)
  })

  it('restSeconds understands seconds, clock times and mixed ranges', () => {
    expect(restSeconds('90 s')).toBe(90)
    expect(restSeconds('90s')).toBe(90)
    expect(restSeconds('45 sec')).toBe(45)
    expect(restSeconds('60-90 seconds')).toBe(60)
    expect(restSeconds('1:30')).toBe(90)
    expect(restSeconds('30s-1 min')).toBe(30)
    expect(restSeconds('1 min 30 s')).toBe(60)
  })

  it('restSeconds: bare numbers, primes and Greek units', () => {
    expect(restSeconds('2')).toBe(120)
    expect(restSeconds('2-3')).toBe(120)
    expect(restSeconds('90')).toBe(90)
    expect(restSeconds("3-5'")).toBe(180)
    expect(restSeconds('45"')).toBe(45)
    expect(restSeconds('2 λεπτά')).toBe(120)
    expect(restSeconds('45 δευτ.')).toBe(45)
  })

  it('restSeconds defaults to 90 s', () => {
    expect(restSeconds('')).toBe(90)
    expect(restSeconds(undefined)).toBe(90)
    expect(restSeconds('N/A')).toBe(90)
  })

  it('program sizes', () => {
    expect(daysPerWeek(BTS_PROGRAM)).toBe(5)
    expect(totalWorkouts(BTS_PROGRAM)).toBe(60)
    expect(totalWorkouts(MINI)).toBe(6)
    expect(daysPerWeek({ ...MINI, weeks: [] })).toBe(0)
  })
})
