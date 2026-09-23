import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { DST_SPRING, at } from './testing/fixtures'
import { getLang, setLang } from '../i18n'
import {
  fmtClock,
  fmtCompact,
  fmtDate,
  fmtDayLabel,
  fmtDuration,
  fmtNum,
  fmtPct,
  fmtRelative,
  fmtSigned,
  fmtVolume,
  fmtWeight,
} from './format'

const MINUS = '−'
const initialLang = getLang()
afterAll(() => setLang(initialLang))

describe('in English', () => {
  beforeEach(() => setLang('en'))

  it('fmtNum rounds to the requested digits with a decimal point', () => {
    expect(fmtNum(80.94)).toBe('80.9')
    expect(fmtNum(80)).toBe('80')
    expect(fmtNum(80, 1, 1)).toBe('80.0')
    expect(fmtNum(1234.56, 0)).toBe('1,235')
    expect(fmtNum(0.25, 2)).toBe('0.25')
  })

  it('fmtCompact abbreviates thousands and millions', () => {
    expect(fmtCompact(950)).toBe('950')
    expect(fmtCompact(12900)).toMatch(/^12\.9k$/i)
    expect(fmtCompact(1_250_000)).toMatch(/^1\.3m$/i)
  })

  it('fmtSigned uses a real minus sign and never prints -0', () => {
    expect(fmtSigned(1.23)).toBe('+1.2')
    expect(fmtSigned(-0.8)).toBe(`${MINUS}0.8`)
    expect(fmtSigned(0)).toBe('0')
    expect(fmtSigned(-0.04)).toBe('0')
    expect(fmtSigned(0.04)).toBe('0')
    expect(fmtSigned(-2.345, 2)).toBe(`${MINUS}2.35`)
  })

  it('fmtPct takes a ratio', () => {
    expect(fmtPct(0.456)).toBe('46%')
    expect(fmtPct(0.456, 1)).toBe('45.6%')
    expect(fmtPct(1)).toBe('100%')
    expect(fmtPct(0)).toBe('0%')
  })

  it('fmtWeight converts from kg to the display unit', () => {
    expect(fmtWeight(80.94, 'kg')).toBe('80.9 kg')
    expect(fmtWeight(80, 'lb')).toBe('176.4 lb')
    expect(fmtWeight(80, 'kg', 0)).toBe('80 kg')
  })

  it('fmtVolume switches to tonnes / thousands of pounds for big numbers', () => {
    expect(fmtVolume(0, 'kg')).toBe('0 kg')
    expect(fmtVolume(950, 'kg')).toBe('950 kg')
    expect(fmtVolume(18_400, 'kg')).toBe('18.4 t')
    expect(fmtVolume(1000, 'kg')).toBe('1 t')
    expect(fmtVolume(1000, 'lb')).toBe('2,205 lb')
    expect(fmtVolume(5000, 'lb')).toBe('11k lb')
  })

  it('fmtVolume never shows "1,000 kg" for values that round up to the threshold', () => {
    expect(fmtVolume(999.6, 'kg')).toBe('1 t')
    expect(fmtVolume(999.4, 'kg')).toBe('999 kg')
    expect(fmtVolume(4535.8, 'lb')).toBe('10k lb') // 9999.7 lb
  })

  it('fmtDate styles', () => {
    const d = '2026-09-22'
    expect(fmtDate(d, 'short')).toMatch(/^22\/0?9$/)
    expect(fmtDate(d)).toBe('22 Sep')
    expect(fmtDate(d, 'medium')).toBe('22 Sep 2026')
    expect(fmtDate(d, 'long')).toBe('Tuesday 22 September')
    expect(fmtDate(d, 'weekday')).toBe('Tue')
    expect(fmtDate(d, 'weekdayDayMonth')).toBe('Tue 22 Sep')
    expect(fmtDate(d, 'month')).toBe('Sep')
    expect(fmtDate('2026-06-01', 'medium')).toBe('1 Jun 2026')
    expect(fmtDate(DST_SPRING, 'long')).toBe('Sunday 29 March')
  })

  it('fmtDayLabel says Today / Yesterday, otherwise weekday + date', () => {
    const now = new Date(2026, 8, 22, 9)
    expect(fmtDayLabel('2026-09-22', now)).toBe('Today')
    expect(fmtDayLabel('2026-09-21', now)).toBe('Yesterday')
    expect(fmtDayLabel('2026-09-20', now)).toBe('Sun 20 Sep')
    expect(fmtDayLabel('2026-09-23', now)).toBe('Wed 23 Sep')
  })

  it('fmtDayLabel right after midnight on the day after a DST switch', () => {
    expect(fmtDayLabel(DST_SPRING, new Date(2026, 2, 30, 0, 5))).toBe('Yesterday')
    expect(fmtDayLabel('2026-03-30', new Date(2026, 2, 30, 0, 5))).toBe('Today')
  })

  it('fmtRelative picks a sensible unit', () => {
    const now = at('2026-09-22', 12)
    const ago = (s: number) => fmtRelative(now - s * 1000, now)
    expect(ago(10)).toBe('now')
    expect(ago(120)).toBe('2 min ago')
    expect(ago(2 * 3600)).toBe('2 hr ago')
    expect(ago(86400)).toBe('yesterday')
    expect(ago(3 * 86400)).toBe('3 days ago')
    expect(ago(14 * 86400)).toBe('2 wk ago')
    expect(ago(60 * 86400)).toBe('2 mo ago')
    expect(fmtRelative(now + 3600 * 1000, now)).toBe('in 1 hr')
  })

  it('fmtRelative does not print "60 min ago" or "24 hr ago" just below a unit boundary', () => {
    const now = at('2026-09-22', 12)
    const ago = (s: number) => fmtRelative(now - s * 1000, now)
    expect(ago(3590)).toBe('1 hr ago')
    expect(ago(86400 - 60)).toBe('yesterday')
    expect(ago(7 * 86400 - 3600)).toMatch(/^last wk\.?$/)
  })

  it('fmtClock', () => {
    expect(fmtClock(65_000)).toBe('1:05')
    expect(fmtClock(3_725_000)).toBe('1:02:05')
    expect(fmtClock(0)).toBe('0:00')
    expect(fmtClock(-5000)).toBe('0:00')
    expect(fmtClock(999)).toBe('0:01')
  })

  it('fmtDuration', () => {
    expect(fmtDuration(3_900_000)).toBe('1 h 5 min')
    expect(fmtDuration(65 * 60_000)).toBe('1 h 5 min')
    expect(fmtDuration(59 * 60_000)).toBe('59 min')
    expect(fmtDuration(60 * 60_000)).toBe('1 h')
    expect(fmtDuration(0)).toBe('0 min')
    expect(fmtDuration(125 * 60_000)).toBe('2 h 5 min')
  })

  it('fmtDuration never reads below 1 min for a positive duration', () => {
    expect(fmtDuration(1000)).toBe('1 min')
    expect(fmtDuration(20_000)).toBe('1 min')
    expect(fmtDuration(-5000)).toBe('0 min')
  })
})

describe('in Greek', () => {
  beforeEach(() => setLang('el'))

  it('uses a decimal comma and dot thousands', () => {
    expect(fmtNum(80.94)).toBe('80,9')
    expect(fmtNum(12345.6)).toBe('12.345,6')
    expect(fmtSigned(-0.8)).toBe(`${MINUS}0,8`)
    expect(fmtSigned(1.25, 2)).toBe('+1,25')
    expect(fmtPct(0.456, 1)).toBe('45,6%')
    expect(fmtWeight(80.94, 'kg')).toBe('80,9 kg')
    expect(fmtVolume(18_400, 'kg')).toBe('18,4 t')
  })

  it('translates day labels and dates', () => {
    const now = new Date(2026, 8, 22, 9)
    expect(fmtDayLabel('2026-09-22', now)).toBe('Σήμερα')
    expect(fmtDayLabel('2026-09-21', now)).toBe('Χθες')
    expect(fmtDate('2026-09-22', 'long')).toBe('Τρίτη 22 Σεπτεμβρίου')
    expect(fmtDate('2026-09-22', 'short')).toBe('22/9')
    expect(fmtDate('2026-09-22')).toBe('22 Σεπ')
  })

  it('fmtDuration in Greek', () => {
    expect(fmtDuration(72 * 60_000)).toBe('1 ώ. 12 λεπ.')
    expect(fmtDuration(12 * 60_000)).toBe('12 λεπ.')
    expect(fmtDuration(120 * 60_000)).toBe('2 ώ.')
    expect(fmtDuration(10_000)).toBe('1 λεπ.')
  })

  it('relative times', () => {
    const now = at('2026-09-22', 12)
    expect(fmtRelative(now - 86400 * 1000, now)).toBe('χθες')
    expect(fmtRelative(now, now)).toBe('τώρα')
  })
})
