import { expect, it } from 'vitest'
import { parseCoachTab } from './tabs'

it('parseCoachTab', () => {
  expect(parseCoachTab(null)).toBe('squad')
  expect(parseCoachTab('programs')).toBe('programs')
  expect(parseCoachTab('nutrition')).toBe('nutrition')
  expect(parseCoachTab('members')).toBe('squad')
  expect(parseCoachTab('nope')).toBe('squad')
})
