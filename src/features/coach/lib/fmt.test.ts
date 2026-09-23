import { describe, expect, it } from 'vitest'
import { fmtDayRange } from './fmt'

describe('fmtDayRange', () => {
  it('shares the month within one month and glues each date', () => {
    expect(fmtDayRange('2026-09-21', '2026-09-27')).toBe('21–27 Sep')
    expect(fmtDayRange('2026-09-28', '2026-10-04')).toBe('28 Sep – 4 Oct')
  })
})
