import { describe, expect, it } from 'vitest'
import { ISSUES, issueText } from './issues'

describe('import issue messages', () => {
  it('has a Greek string for every English one, with the same placeholders', () => {
    const vars = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort()
    expect(Object.keys(ISSUES.el).sort()).toEqual(Object.keys(ISSUES.en).sort())
    for (const k of Object.keys(ISSUES.en) as (keyof typeof ISSUES.en)[]) {
      expect(ISSUES.el[k], k).toBeTruthy()
      expect(vars(ISSUES.el[k]), k).toEqual(vars(ISSUES.en[k]))
    }
  })

  it('prefixes the row or the exercise the issue is about', () => {
    expect(issueText({ key: 'dayEmpty', row: 5 }, 'en')).toBe('Row 5: the day is empty.')
    expect(issueText({ key: 'dayEmpty', row: 5 }, 'el')).toBe('Γραμμή 5: η μέρα είναι κενή.')
    const at = { week: 2, day: 1, name: 'Upper', ex: 3 }
    expect(issueText({ key: 'badReps', vars: { value: 'ten' }, at }, 'en')).toBe('Week 2, day 1 (Upper), exercise 3: reps "ten" is not a number or a range like 8-10.')
    expect(issueText({ key: 'fileEmpty' }, 'el')).toBe('Το αρχείο είναι κενό.')
  })
})
