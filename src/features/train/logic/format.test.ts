import { describe, expect, it } from 'vitest'
import { setLang } from '../../../i18n'
import { durationParts, fmtRange, fmtRestShort, fmtRpe, fmtTypedWeight, swapCount, textLang, upperText } from './format'

describe('prescription formatting', () => {
  it('uses en dashes in ranges', () => {
    expect(fmtRange('8-10')).toBe('8–10')
    expect(fmtRange('10 - 20')).toBe('10–20')
    expect(fmtRange('12')).toBe('12')
  })

  it('formats RPE and hides N/A', () => {
    expect(fmtRpe('~8-9')).toBe('~8–9')
    expect(fmtRpe('10')).toBe('10')
    expect(fmtRpe('N/A')).toBeNull()
    expect(fmtRpe('')).toBeNull()
  })

  it('shortens rests', () => {
    expect(fmtRestShort('2-3 min')).toBe('2–3′')
    expect(fmtRestShort('3-5 min')).toBe('3–5′')
    expect(fmtRestShort('2 minutes')).toBe('2′')
    expect(fmtRestShort('90 s')).toBe('90″')
    expect(fmtRestShort('45-60 sec')).toBe('45–60″')
    expect(fmtRestShort('1:30')).toBe('1:30')
    expect(fmtRestShort('as needed')).toBe('as needed')
    expect(fmtRestShort('')).toBe('—')
  })

  it('shows typed weights in the current locale', () => {
    setLang('en')
    expect(fmtTypedWeight('57,5')).toBe('57.5')
    expect(fmtTypedWeight('')).toBe('')
    setLang('el')
    expect(fmtTypedWeight('57.5')).toBe('57,5')
    setLang('en')
  })

  it('counts swaps', () => {
    expect(swapCount({ s1: 'a', s2: 'b' })).toBe(2)
    expect(swapCount({ s1: 'a' })).toBe(1)
    expect(swapCount({})).toBe(0)
  })
})

describe('durationParts', () => {
  it('splits into hours and whole minutes', () => {
    expect(durationParts(70 * 60000)).toEqual({ h: 1, m: 10 })
    expect(durationParts(48.4 * 60000)).toEqual({ h: 0, m: 48 })
    expect(durationParts(2 * 3600000)).toEqual({ h: 2, m: 0 })
    expect(durationParts(5000)).toEqual({ h: 0, m: 1 })
  })
})

describe('Greek-aware text helpers', () => {
  it('tags Greek program strings as el and the rest as en', () => {
    expect(textLang('Πόδια')).toBe('el')
    expect(textLang('Upper')).toBe('en')
  })
  it('uppercases Greek without the tonos, keeps the dialytika, leaves Latin alone', () => {
    expect(upperText('Πόδια')).toBe('ΠΟΔΙΑ')
    expect(upperText('Ώμοι')).toBe('ΩΜΟΙ')
    expect(upperText('Άρης').charAt(0)).toBe('Α')
    expect(upperText('προϊόν')).toBe('ΠΡΟΪΟΝ')
    expect(upperText('ΐ')).toBe('Ϊ')
    expect(upperText('Café')).toBe('CAFÉ')
  })
})
