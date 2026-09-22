import { describe, expect, it } from 'vitest'
import { DST_AUTUMN, DST_SPRING, at } from './testing/fixtures'
import {
  addDays,
  dateRange,
  diffDays,
  fromISODate,
  isISODate,
  isoFromMs,
  maxDate,
  minDate,
  nextMonday,
  startOfWeek,
  toISODate,
  todayISO,
} from './dates'

describe('time zone fixture', () => {
  it('runs in a zone with DST so the boundary tests mean something', () => {
    expect(new Date(2026, 2, 28, 12).getTimezoneOffset()).toBe(-120)
    expect(new Date(2026, 2, 29, 12).getTimezoneOffset()).toBe(-180)
    expect(new Date(2026, 9, 25, 12).getTimezoneOffset()).toBe(-120)
  })
})

describe('toISODate / fromISODate', () => {
  it('formats local calendar dates with zero padding', () => {
    expect(toISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(toISODate(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })

  it('parses to local noon, also on DST days', () => {
    for (const d of [DST_SPRING, DST_AUTUMN, '2026-01-01']) {
      const date = fromISODate(d)
      expect(date.getHours()).toBe(12)
      expect(toISODate(date)).toBe(d)
    }
  })

  it('round-trips every day of a year (no skipped or doubled dates)', () => {
    let d = '2026-01-01'
    const seen = new Set<string>()
    for (let i = 0; i < 365; i++) {
      expect(toISODate(fromISODate(d))).toBe(d)
      seen.add(d)
      d = addDays(d, 1)
    }
    expect(seen.size).toBe(365)
    expect(d).toBe('2027-01-01')
  })

  it('local midnight right after the spring-forward switch still maps to the same date', () => {
    expect(toISODate(new Date(2026, 2, 29, 0, 30))).toBe(DST_SPRING)
    expect(isoFromMs(at(DST_SPRING, 3, 30))).toBe(DST_SPRING)
    expect(isoFromMs(at(DST_AUTUMN, 3, 30))).toBe(DST_AUTUMN)
    expect(isoFromMs(at(DST_AUTUMN, 23, 59))).toBe(DST_AUTUMN)
  })
})

describe('isISODate', () => {
  it('accepts real calendar dates, including leap days', () => {
    expect(isISODate('2026-09-22')).toBe(true)
    expect(isISODate('2028-02-29')).toBe(true)
    expect(isISODate('2000-02-29')).toBe(true)
  })

  it('rejects malformed input', () => {
    for (const s of ['', '2026-9-22', '22/09/2026', '2026-09-22T10:00', ' 2026-09-22', '2026-09-2x']) expect(isISODate(s)).toBe(false)
    for (const s of [null, undefined, 20260922, {}, new Date()]) expect(isISODate(s)).toBe(false)
  })

  it('rejects impossible dates that the Date constructor would silently roll over', () => {
    for (const s of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31', '2026-01-00', '1900-02-29'])
      expect(isISODate(s)).toBe(false)
  })
})

describe('todayISO / isoFromMs', () => {
  it('uses the injected clock and the local calendar', () => {
    expect(todayISO(new Date(2026, 8, 22, 0, 1))).toBe('2026-09-22')
    expect(todayISO(new Date(2026, 8, 22, 23, 59))).toBe('2026-09-22')
    expect(isoFromMs(new Date(2026, 8, 21, 23, 59, 59).getTime())).toBe('2026-09-21')
  })

  it('defaults to the real clock', () => {
    expect(isISODate(todayISO())).toBe(true)
  })
})

describe('addDays / diffDays', () => {
  it('steps across both DST switches without losing or repeating a date', () => {
    expect(addDays('2026-03-28', 1)).toBe(DST_SPRING)
    expect(addDays(DST_SPRING, 1)).toBe('2026-03-30')
    expect(addDays('2026-03-30', -2)).toBe('2026-03-28')
    expect(addDays('2026-10-24', 1)).toBe(DST_AUTUMN)
    expect(addDays(DST_AUTUMN, 1)).toBe('2026-10-26')
    expect(addDays('2026-10-26', -2)).toBe('2026-10-24')
  })

  it('handles month, year and leap-year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-09-22', 0)).toBe('2026-09-22')
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01')
  })

  it('counts whole days across DST (23 h and 25 h days are still one day)', () => {
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2)
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2)
    expect(diffDays('2026-01-01', '2027-01-01')).toBe(365)
    expect(diffDays('2026-09-22', '2026-09-15')).toBe(-7)
    expect(diffDays('2026-09-22', '2026-09-22')).toBe(0)
  })

  it('addDays and diffDays are inverse for every offset over a year', () => {
    for (let n = -400; n <= 400; n += 7) expect(diffDays(DST_SPRING, addDays(DST_SPRING, n))).toBe(n)
  })
})

describe('startOfWeek / nextMonday', () => {
  it('returns the Monday of the (Mon-Sun) week', () => {
    expect(startOfWeek('2026-09-21')).toBe('2026-09-21') // Monday
    expect(startOfWeek('2026-09-22')).toBe('2026-09-21')
    expect(startOfWeek('2026-09-27')).toBe('2026-09-21') // Sunday
    expect(startOfWeek('2026-01-01')).toBe('2025-12-29') // crosses the year
  })

  it('works on the DST Sundays themselves', () => {
    expect(startOfWeek(DST_SPRING)).toBe('2026-03-23')
    expect(startOfWeek(DST_AUTUMN)).toBe('2026-10-19')
    expect(startOfWeek('2026-03-30')).toBe('2026-03-30')
  })

  it('nextMonday is the same day on a Monday, otherwise the following Monday', () => {
    expect(nextMonday('2026-09-21')).toBe('2026-09-21')
    expect(nextMonday('2026-09-22')).toBe('2026-09-28')
    expect(nextMonday(DST_SPRING)).toBe('2026-03-30')
    expect(nextMonday(DST_AUTUMN)).toBe('2026-10-26')
  })
})

describe('dateRange / minDate / maxDate', () => {
  it('is inclusive and continuous across DST', () => {
    expect(dateRange('2026-03-27', '2026-03-31')).toEqual(['2026-03-27', '2026-03-28', DST_SPRING, '2026-03-30', '2026-03-31'])
    expect(dateRange('2026-10-24', '2026-10-26')).toEqual(['2026-10-24', DST_AUTUMN, '2026-10-26'])
  })

  it('single day and reversed ranges', () => {
    expect(dateRange('2026-09-22', '2026-09-22')).toEqual(['2026-09-22'])
    expect(dateRange('2026-09-23', '2026-09-22')).toEqual([])
  })

  it('min / max compare calendar order', () => {
    expect(minDate('2026-09-22', '2026-10-01')).toBe('2026-09-22')
    expect(maxDate('2026-09-22', '2026-10-01')).toBe('2026-10-01')
    expect(minDate('2026-09-22', '2026-09-22')).toBe('2026-09-22')
  })
})
