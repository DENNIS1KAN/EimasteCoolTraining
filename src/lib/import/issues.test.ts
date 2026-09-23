import { describe, expect, it } from 'vitest'
import { ISSUES, issueText } from './issues'

describe('import issue messages', () => {
  it('has a non-empty string for every issue key', () => {
    for (const k of Object.keys(ISSUES.en) as (keyof typeof ISSUES.en)[]) {
      expect(ISSUES.en[k], k).toBeTruthy()
    }
  })

  it('prefixes the row or the exercise the issue is about', () => {
    expect(issueText({ key: 'dayEmpty', row: 5 })).toBe('Row 5: the day is empty.')
    const at = { week: 2, day: 1, name: 'Upper', ex: 3 }
    expect(issueText({ key: 'badReps', vars: { value: 'ten' }, at })).toBe('Week 2, day 1 (Upper), exercise 3: reps "ten" is not a number or a range like 8-10.')
    expect(issueText({ key: 'fileEmpty' })).toBe('The file is empty.')
  })
})
