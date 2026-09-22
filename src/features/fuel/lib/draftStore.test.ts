import { afterEach, describe, expect, it } from 'vitest'
import { emptyDraft } from './draft'
import { clearDraft, DRAFT_MAX_AGE_MS, draftKey, isPlanDraft, loadDraft, storeDraft } from './draftStore'

const key = draftKey('m1', 'new')
const draft = {
  ...emptyDraft('2026-09-22'),
  title: 'Cut v3',
  meals: [{ id: 'a', name: 'Breakfast', time: '08:00', items: 'Oats', kcal: '400', protein: '30' }],
  files: [{ path: 'm1/x.pdf', name: 'plan.pdf', type: 'application/pdf', size: 10 }],
}

afterEach(() => localStorage.clear())

describe('stored meal plan drafts', () => {
  it('round-trips a draft per member and plan', () => {
    storeDraft(key, draft, 1000)
    expect(loadDraft(key, 2000)).toEqual({ draft, savedAt: 1000 })
    expect(loadDraft(draftKey('m1', 'p1'), 2000)).toBeNull()
    clearDraft(key)
    expect(loadDraft(key, 2000)).toBeNull()
  })
  it('drops stale or malformed drafts', () => {
    storeDraft(key, draft, 1000)
    expect(loadDraft(key, 1000 + DRAFT_MAX_AGE_MS + 1)).toBeNull()
    expect(localStorage.getItem(key)).toBeNull()
    localStorage.setItem(key, '{"savedAt":1,"draft":{"title":3}}')
    expect(loadDraft(key, 2)).toBeNull()
    localStorage.setItem(key, 'not json')
    expect(loadDraft(key, 2)).toBeNull()
  })
  it('checks the draft shape', () => {
    expect(isPlanDraft(draft)).toBe(true)
    expect(isPlanDraft({ ...draft, meals: [{ id: 'a' }] })).toBe(false)
    expect(isPlanDraft({ ...draft, kcal: 2400 })).toBe(false)
    expect(isPlanDraft(null)).toBe(false)
  })
})
