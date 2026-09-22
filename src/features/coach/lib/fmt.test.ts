import { afterEach, describe, expect, it } from 'vitest'
import { setLang } from '../../../i18n'
import { fmtDayRange } from './fmt'

afterEach(() => setLang('en'))

describe('fmtDayRange', () => {
  it('shares the month within one month and glues each date', () => {
    setLang('en')
    expect(fmtDayRange('2026-09-21', '2026-09-27')).toBe('21–27 Sep')
    expect(fmtDayRange('2026-09-28', '2026-10-04')).toBe('28 Sep – 4 Oct')
    setLang('el')
    expect(fmtDayRange('2026-09-21', '2026-09-27')).toBe('21–27 Σεπ')
  })
})
