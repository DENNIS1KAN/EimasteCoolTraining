import { describe, expect, it } from 'vitest'
import { glassCount, glassesOf, tapGlass } from './water'

describe('water glasses', () => {
  it('derives the glass count from the target', () => {
    expect(glassCount(3)).toBe(12)
    expect(glassCount(3.1)).toBe(13)
    expect(glassCount(null)).toBe(10)
    expect(glassCount(0.5)).toBe(4)
    expect(glassCount(20)).toBe(24)
  })
  it('counts filled glasses', () => {
    expect(glassesOf(null)).toBe(0)
    expect(glassesOf(1.25)).toBe(5)
    expect(glassesOf(1.3)).toBe(5)
  })
  it('fills up to the tapped glass and undoes the last one', () => {
    expect(tapGlass(null, 0)).toBe(0.25)
    expect(tapGlass(0.25, 3)).toBe(1)
    expect(tapGlass(1, 3)).toBe(0.75)
    expect(tapGlass(1, 1)).toBe(0.5)
    expect(tapGlass(0.25, 0)).toBe(0)
  })
})
