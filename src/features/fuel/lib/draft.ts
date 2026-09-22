import type { FileRef, Meal, MealPlan } from '../../../data/types'
import { isISODate, type ISODate } from '../../../lib/dates'
import { parseNum } from '../../../lib/units'
import { mealMinutes } from './day'

/** Editor state: numbers stay as typed strings until saved. */
export interface MealDraft {
  id: string
  name: string
  time: string
  items: string
  kcal: string
  protein: string
}

export type TargetKey = 'kcal' | 'protein' | 'carbs' | 'fat' | 'waterL'
export const TARGET_KEYS: TargetKey[] = ['kcal', 'protein', 'carbs', 'fat', 'waterL']

export interface PlanDraft extends Record<TargetKey, string> {
  title: string
  startDate: ISODate
  notes: string
  meals: MealDraft[]
  files: FileRef[]
  active: boolean
}

const str = (n: number | null | undefined): string => (n == null ? '' : String(n))
const num = (s: string): number | null => {
  const n = parseNum(s)
  return n == null ? null : n
}

export function mealDraftFrom(m: Meal): MealDraft {
  return { id: m.id, name: m.name, time: m.time, items: m.items, kcal: str(m.kcal), protein: str(m.protein) }
}

export function draftFromPlan(p: MealPlan): PlanDraft {
  return {
    title: p.title,
    startDate: p.startDate,
    notes: p.notes,
    kcal: str(p.kcal),
    protein: str(p.protein),
    carbs: str(p.carbs),
    fat: str(p.fat),
    waterL: str(p.waterL),
    meals: p.meals.map(mealDraftFrom),
    files: [...p.files],
    active: p.active,
  }
}

export function emptyDraft(today: ISODate): PlanDraft {
  return { title: '', startDate: today, notes: '', kcal: '', protein: '', carbs: '', fat: '', waterL: '', meals: [], files: [], active: true }
}

/** "Cut phase · v2" -> "Cut phase · v3", "Lean bulk" -> "Lean bulk · v2". */
export function bumpTitle(title: string): string {
  const t = title.trim()
  if (!t) return t
  const m = /^(.*?)(\bv)(\d+)$/i.exec(t)
  if (m) return `${m[1]}${m[2]}${Number(m[3]) + 1}`
  return `${t} · v2`
}

/** A new draft copied from an earlier plan: fresh meal ids, a bumped title, starting today, active. */
export function duplicateDraft(prev: MealPlan, today: ISODate, newId: () => string): PlanDraft {
  const d = draftFromPlan(prev)
  return { ...d, title: bumpTitle(prev.title), startDate: today, active: true, meals: d.meals.map((m) => ({ ...m, id: newId() })) }
}

/** kcal implied by macros (4 / 4 / 9 kcal per gram); null when no macro is filled in. */
export function kcalFromMacros(protein: number | null, carbs: number | null, fat: number | null): number | null {
  if (protein == null && carbs == null && fat == null) return null
  return Math.round((protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9)
}

export const draftMacroKcal = (d: Pick<PlanDraft, 'protein' | 'carbs' | 'fat'>): number | null =>
  kcalFromMacros(num(d.protein), num(d.carbs), num(d.fat))

/** Sum of the meals' kcal in a draft, or null when none has kcal. */
export function draftMealsKcal(meals: MealDraft[]): number | null {
  const vals = meals.map((m) => num(m.kcal)).filter((n): n is number => n != null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null
}

export type FieldError = 'required' | 'number' | 'range' | 'time' | 'date'
export interface DraftErrors {
  fields: Partial<Record<'title' | 'startDate' | TargetKey, FieldError>>
  meals: Record<string, Partial<Record<'name' | 'time' | 'kcal' | 'protein', FieldError>>>
}

const LIMITS: Record<TargetKey | 'mealKcal' | 'mealProtein', number> = {
  kcal: 10000,
  protein: 1000,
  carbs: 1500,
  fat: 1000,
  waterL: 10,
  mealKcal: 5000,
  mealProtein: 500,
}

function checkNum(s: string, max: number): FieldError | undefined {
  if (!s.trim()) return undefined
  const n = parseNum(s)
  if (n == null) return 'number'
  if (n < 0 || n > max) return 'range'
  return undefined
}

export function validateDraft(d: PlanDraft): DraftErrors {
  const fields: DraftErrors['fields'] = {}
  if (!d.title.trim()) fields.title = 'required'
  if (!isISODate(d.startDate)) fields.startDate = 'date'
  for (const k of TARGET_KEYS) {
    const e = checkNum(d[k], LIMITS[k])
    if (e) fields[k] = e
  }
  const meals: DraftErrors['meals'] = {}
  for (const m of d.meals) {
    const e: DraftErrors['meals'][string] = {}
    if (!m.name.trim()) e.name = 'required'
    if (m.time.trim() && mealMinutes(m.time) == null) e.time = 'time'
    const k = checkNum(m.kcal, LIMITS.mealKcal)
    if (k) e.kcal = k
    const p = checkNum(m.protein, LIMITS.mealProtein)
    if (p) e.protein = p
    if (Object.keys(e).length) meals[m.id] = e
  }
  return { fields, meals }
}

export const hasErrors = (e: DraftErrors): boolean => Object.keys(e.fields).length > 0 || Object.keys(e.meals).length > 0

/** Zero-pad "8:00" to "08:00" so times sort as text. */
function normTime(t: string): string {
  const min = mealMinutes(t)
  if (min == null) return ''
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/** Build the stored plan. `updatedAt` is stamped by the store. */
export function planFromDraft(d: PlanDraft, base: Pick<MealPlan, 'id' | 'memberId' | 'createdBy' | 'createdAt'>): MealPlan {
  const items = (s: string) =>
    s
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n')
  return {
    ...base,
    title: d.title.trim(),
    notes: d.notes.replace(/\s+$/, ''),
    startDate: d.startDate,
    kcal: num(d.kcal),
    protein: num(d.protein),
    carbs: num(d.carbs),
    fat: num(d.fat),
    waterL: num(d.waterL),
    meals: d.meals.map((m) => ({
      id: m.id,
      name: m.name.trim(),
      time: normTime(m.time),
      items: items(m.items),
      kcal: num(m.kcal),
      protein: num(m.protein),
    })),
    files: d.files,
    active: d.active,
    updatedAt: 0,
  }
}

/** The member's other active plans, which saving `keepId` as active must switch off. */
export function othersToDeactivate(plans: MealPlan[], memberId: string, keepId: string): MealPlan[] {
  return plans.filter((p) => p.memberId === memberId && p.id !== keepId && p.active)
}

/** Move an item from one index to another (out-of-range moves are ignored). */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) return arr
  const out = [...arr]
  const [x] = out.splice(from, 1)
  out.splice(to, 0, x)
  return out
}

/** Deep-ish equality of two drafts, to know whether there are unsaved changes. */
export const sameDraft = (a: PlanDraft, b: PlanDraft): boolean => JSON.stringify(a) === JSON.stringify(b)
