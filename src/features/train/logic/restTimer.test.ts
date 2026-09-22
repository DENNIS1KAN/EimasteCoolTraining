import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTO_HIDE_MS, adjustRest, getRest, restFraction, restRemaining, startRest, stopRest, subscribeRest } from './restTimer'

const T0 = 1_700_000_000_000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})
afterEach(() => {
  stopRest()
  vi.useRealTimers()
})

describe('rest timer', () => {
  it('counts down from the prescribed rest', () => {
    startRest({ seconds: 150, next: ['Next', 'Set 2'] })
    const s = getRest()!
    expect(restRemaining(s, T0)).toBe(150_000)
    expect(restRemaining(s, T0 + 30_000)).toBe(120_000)
    expect(restFraction(s, T0 + 75_000)).toBeCloseTo(0.5)
    expect(s.zeroAt).toBeNull()
  })

  it('notifies subscribers and bumps the id on every start', () => {
    const f = vi.fn()
    const off = subscribeRest(f)
    startRest({ seconds: 60, next: ['a', 'b'] })
    const id = getRest()!.id
    startRest({ seconds: 60, next: ['a', 'b'] })
    expect(getRest()!.id).toBe(id + 1)
    expect(f).toHaveBeenCalledTimes(2)
    off()
  })

  it('+30 s extends the countdown and the total; −15 s shortens it', () => {
    startRest({ seconds: 60, next: ['a', 'b'] })
    adjustRest(30)
    expect(restRemaining(getRest()!, T0)).toBe(90_000)
    expect(getRest()!.total).toBe(90_000)
    adjustRest(-15)
    expect(restRemaining(getRest()!, T0)).toBe(75_000)
    expect(getRest()!.total).toBe(90_000)
  })

  it('reaches zero on time, then hides itself two minutes later', () => {
    startRest({ seconds: 60, next: ['a', 'b'] })
    vi.advanceTimersByTime(59_000)
    expect(getRest()!.zeroAt).toBeNull()
    vi.advanceTimersByTime(1_000)
    expect(getRest()!.zeroAt).toBe(T0 + 60_000)
    vi.advanceTimersByTime(AUTO_HIDE_MS - 1)
    expect(getRest()).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(getRest()).toBeNull()
  })

  it('−15 s past the end goes straight to zero', () => {
    startRest({ seconds: 10, next: ['a', 'b'] })
    adjustRest(-15)
    expect(getRest()!.zeroAt).toBe(T0)
  })

  it('+30 s after zero starts a fresh 30 s countdown', () => {
    startRest({ seconds: 10, next: ['a', 'b'] })
    vi.advanceTimersByTime(20_000)
    expect(getRest()!.zeroAt).not.toBeNull()
    adjustRest(30)
    const s = getRest()!
    expect(s.zeroAt).toBeNull()
    expect(restRemaining(s, Date.now())).toBe(30_000)
    expect(s.total).toBe(30_000)
    adjustRest(-15)
    vi.advanceTimersByTime(15_000)
    expect(getRest()!.zeroAt).not.toBeNull()
  })

  it('stops', () => {
    startRest({ seconds: 10, next: ['a', 'b'] })
    stopRest()
    expect(getRest()).toBeNull()
    vi.advanceTimersByTime(20_000)
    expect(getRest()).toBeNull()
  })
})
