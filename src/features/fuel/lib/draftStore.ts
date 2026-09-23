import type { FileRef } from '../../../data/types'
import type { FoodDraft, MealDraft, PlanDraft } from './draft'
import { TARGET_KEYS } from './draft'

/**
 * Unsaved meal-plan drafts, kept on this device so a stray tap on a tab, the phone's back gesture or a reload never
 * throws away a plan the coach is typing. One draft per member and plan ("new" for a plan not saved yet).
 * Per-device convenience only: every read and write tolerates blocked or cleared storage.
 */
export interface StoredDraft {
  draft: PlanDraft
  savedAt: number
}

const PREFIX = 'ect-plan-draft:'
/** Drafts older than this are dropped instead of offered. */
export const DRAFT_MAX_AGE_MS = 14 * 24 * 3600 * 1000

export const draftKey = (memberId: string, planId: string): string => `${PREFIX}${memberId}:${planId}`

const isStr = (v: unknown): v is string => typeof v === 'string'
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v != null && !Array.isArray(v)

function isFood(v: unknown): v is FoodDraft {
  return (
    isObj(v) &&
    isStr(v.id) &&
    (v.ref === null || isStr(v.ref)) &&
    ['name', 'grams', 'pieces', 'kcal', 'protein', 'carbs', 'fat'].every((k) => isStr(v[k])) &&
    typeof v.manual === 'boolean'
  )
}

/** A stored meal; drafts saved by builds before food lists lack carbs, fat and foods (filled in by normalize). */
function isMeal(v: unknown): boolean {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.name) &&
    isStr(v.time) &&
    isStr(v.items) &&
    isStr(v.kcal) &&
    isStr(v.protein) &&
    (v.carbs === undefined || isStr(v.carbs)) &&
    (v.fat === undefined || isStr(v.fat)) &&
    (v.foods === undefined || (Array.isArray(v.foods) && v.foods.every(isFood)))
  )
}

const normalizeMeal = (m: MealDraft): MealDraft => ({ ...m, carbs: m.carbs ?? '', fat: m.fat ?? '', foods: m.foods ?? [] })

function isFile(v: unknown): v is FileRef {
  return isObj(v) && isStr(v.path) && isStr(v.name)
}

/** Shape check for what comes back from storage (an older build or a hand-edited value must not crash the editor). */
export function isPlanDraft(v: unknown): v is PlanDraft {
  return (
    isObj(v) &&
    isStr(v.title) &&
    isStr(v.startDate) &&
    isStr(v.notes) &&
    typeof v.active === 'boolean' &&
    TARGET_KEYS.every((k) => isStr(v[k])) &&
    Array.isArray(v.meals) &&
    v.meals.every(isMeal) &&
    Array.isArray(v.files) &&
    v.files.every(isFile)
  )
}

export function loadDraft(key: string, now: number = Date.now()): StoredDraft | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const v: unknown = JSON.parse(raw)
    if (isObj(v) && typeof v.savedAt === 'number' && now - v.savedAt <= DRAFT_MAX_AGE_MS && isPlanDraft(v.draft)) {
      return { draft: { ...v.draft, meals: v.draft.meals.map(normalizeMeal) }, savedAt: v.savedAt }
    }
    localStorage.removeItem(key)
  } catch {
    /* unreadable: treat as no draft */
  }
  return null
}

export function storeDraft(key: string, draft: PlanDraft, now: number = Date.now()): void {
  try {
    localStorage.setItem(key, JSON.stringify({ draft, savedAt: now } satisfies StoredDraft))
  } catch {
    /* storage full or blocked: the beforeunload and back-link guards still apply */
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* nothing to clear */
  }
}
