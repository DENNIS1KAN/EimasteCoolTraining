import { describe, expect, it } from 'vitest'
import { LB_PER_KG, kgToUnit, parseNum, roundToPlate, unitToKg } from './units'

describe('kgToUnit / unitToKg', () => {
  it('kg is the identity', () => {
    expect(kgToUnit(80.5, 'kg')).toBe(80.5)
    expect(unitToKg(80.5, 'kg')).toBe(80.5)
  })

  it('converts pounds with the exact factor and round-trips', () => {
    expect(kgToUnit(100, 'lb')).toBeCloseTo(220.462, 3)
    expect(unitToKg(225, 'lb')).toBeCloseTo(102.058, 3)
    expect(unitToKg(kgToUnit(57.5, 'lb'), 'lb')).toBeCloseTo(57.5, 10)
    expect(LB_PER_KG).toBeCloseTo(1 / 0.45359237, 9)
  })
})

describe('parseNum', () => {
  it('accepts dot and comma decimals, surrounding spaces and signs', () => {
    expect(parseNum('80.5')).toBe(80.5)
    expect(parseNum('57,5')).toBe(57.5)
    expect(parseNum(' 80 ')).toBe(80)
    expect(parseNum('-2,5')).toBe(-2.5)
    expect(parseNum('+5')).toBe(5)
    expect(parseNum('.5')).toBe(0.5)
    expect(parseNum(',5')).toBe(0.5)
    expect(parseNum('5.')).toBe(5)
    expect(parseNum('0')).toBe(0)
  })

  it('returns null for empty input', () => {
    expect(parseNum('')).toBeNull()
    expect(parseNum('   ')).toBeNull()
    expect(parseNum(null)).toBeNull()
    expect(parseNum(undefined)).toBeNull()
  })

  it('passes finite numbers through and rejects NaN / Infinity', () => {
    expect(parseNum(42)).toBe(42)
    expect(parseNum(0)).toBe(0)
    expect(parseNum(Number.NaN)).toBeNull()
    expect(parseNum(Number.POSITIVE_INFINITY)).toBeNull()
    expect(parseNum('Infinity')).toBeNull()
  })

  it('rejects text, units and ambiguous thousands separators instead of guessing', () => {
    for (const s of ['abc', '5kg', '1,234.5', '1.234,5', '1,2,3', ',', '.', '-', '5 5']) expect(parseNum(s)).toBeNull()
  })

  it('rejects non-decimal notations that Number() would accept (hex, binary, exponent)', () => {
    for (const s of ['0x10', '0b101', '0o7', '1e3']) expect(parseNum(s)).toBeNull()
  })
})

describe('roundToPlate', () => {
  it('rounds to 2.5 kg', () => {
    expect(roundToPlate(81, 'kg')).toBe(80)
    expect(roundToPlate(81.3, 'kg')).toBe(82.5)
    expect(roundToPlate(83.75, 'kg')).toBe(85) // halfway rounds up
  })

  it('rounds to 5 lb', () => {
    expect(roundToPlate(183, 'lb')).toBe(185)
    expect(roundToPlate(182, 'lb')).toBe(180)
  })
})
