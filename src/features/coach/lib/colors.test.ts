import { describe, expect, it } from 'vitest'
import { firstFreeColor, usedColors } from './colors'

const w = (id: string, color: 'blue' | 'orange' | 'aqua' | 'yellow') => ({ id, name: id.toUpperCase(), color })

describe('colors', () => {
  it('usedColors skips the member being edited', () => {
    const used = usedColors([w('a', 'blue'), w('b', 'orange')], 'a')
    expect([...used.keys()]).toEqual(['orange'])
    expect(used.get('orange')).toBe('B')
  })
  it('firstFreeColor follows the validated order', () => {
    expect(firstFreeColor([])).toBe('blue')
    expect(firstFreeColor([w('a', 'blue'), w('b', 'orange'), w('c', 'aqua')])).toBe('yellow')
    expect(firstFreeColor([w('a', 'orange')])).toBe('blue')
  })
})
