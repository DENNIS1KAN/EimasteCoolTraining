import type { FileRef, Meal, MealFood, MealPlan } from '../../../data/types'
import { isISODate, type ISODate } from '../../../lib/dates'
import { parseNum } from '../../../lib/units'
import { foodById, macrosFor, type Food, type Macros } from '../foods'
import { mealMinutes } from './day'
import { MACRO_FIELDS, sumMacros, withDerivedTotals, type MacroField } from './macros'

/**
 * One food of a meal in the editor. Numbers stay as typed strings. A database food (`ref`) has its macros
 * computed from the grams until the coach overrides one (`manual`); a custom food's macros are always typed.
 */
export interface FoodDraft {
  id: string
  ref: string | null
  name: string
  grams: string
  /** Counted by the piece ("2" eggs): grams follow pieces x the food's unit weight. "" = weighed in grams. */
  pieces: string
  kcal: string
  protein: string
  carbs: string
  fat: string
  manual: boolean
}

/** Editor state: numbers stay as typed strings until saved. */
export interface MealDraft {
  id: string
  name: string
  time: string
  /** Notes for the meal (old plans: the foods, one per line). */
  items: string
  /** Typed totals, used when the meal has no food list. */
  kcal: string
  protein: string
  carbs: string
  fat: string
  foods: FoodDraft[]
}

export type TargetKey = 'kcal' | 'protein' | 'carbs' | 'fat'
export const TARGET_KEYS: TargetKey[] = ['kcal', 'protein', 'carbs', 'fat']

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

const fmtG = (n: number): string => String(Math.round(n * 10) / 10)

function computed(ref: string | null, grams: string): Macros | null {
  const food = foodById(ref)
  const g = num(grams)
  return food && g != null ? macrosFor(food, g) : null
}

const macroStrings = (m: Macros): Pick<FoodDraft, MacroField> => ({ kcal: str(m.kcal), protein: str(m.protein), carbs: str(m.carbs), fat: str(m.fat) })

export function foodDraftFrom(f: MealFood): FoodDraft {
  const ref = f.ref ?? null
  const grams = str(f.grams)
  const auto = computed(ref, grams)
  // Numbers that no longer match the database (typed over, or the database changed since) are kept as typed.
  const manual = !auto || MACRO_FIELDS.some((k) => (auto[k] ?? null) !== (f[k] ?? null))
  return { id: f.id, ref, name: f.name, grams, pieces: str(f.pieces), ...macroStrings(f), manual }
}

export function mealDraftFrom(m: Meal): MealDraft {
  return {
    id: m.id,
    name: m.name,
    time: m.time,
    items: m.items,
    kcal: str(m.kcal),
    protein: str(m.protein),
    carbs: str(m.carbs),
    fat: str(m.fat),
    foods: (m.foods ?? []).map(foodDraftFrom),
  }
}

/** A food picked from the database: one piece for foods counted by the piece, else 100 g. */
export function foodDraftOf(food: Food, name: string, id: string): FoodDraft {
  const grams = food.unit ? fmtG(food.unit.g) : '100'
  return { id, ref: food.id, name, grams, pieces: food.unit ? '1' : '', ...macroStrings(macrosFor(food, num(grams) ?? 0)), manual: false }
}

/** A food typed by the coach, macros entered by hand. */
export const customFoodDraft = (name: string, id: string): FoodDraft => ({
  id,
  ref: null,
  name,
  grams: '',
  pieces: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
  manual: true,
})

/** Recompute a database food's macros from its grams (unless typed over). */
function recompute(fd: FoodDraft): FoodDraft {
  if (fd.manual) return fd
  const auto = computed(fd.ref, fd.grams)
  return auto ? { ...fd, ...macroStrings(auto) } : { ...fd, kcal: '', protein: '', carbs: '', fat: '' }
}

export function setFoodGrams(fd: FoodDraft, grams: string): FoodDraft {
  return recompute({ ...fd, grams, pieces: '' })
}

export function setFoodPieces(fd: FoodDraft, pieces: string): FoodDraft {
  const unit = foodById(fd.ref)?.unit
  const n = num(pieces)
  const grams = unit && n != null ? fmtG(n * unit.g) : fd.grams
  return recompute({ ...fd, pieces, grams })
}

/** Switch between weighing in grams and counting pieces (foods with a unit only). */
export function setFoodByPiece(fd: FoodDraft, byPiece: boolean): FoodDraft {
  const unit = foodById(fd.ref)?.unit
  if (!unit) return fd
  if (!byPiece) return { ...fd, pieces: '' }
  const g = num(fd.grams)
  const pcs = g != null && g > 0 ? Math.max(0.5, Math.round((g / unit.g) * 2) / 2) : 1
  return setFoodPieces(fd, String(pcs))
}

/** The coach typed over a number: it is kept as typed from now on. */
export const setFoodMacro = (fd: FoodDraft, field: MacroField, v: string): FoodDraft => ({ ...fd, [field]: v, manual: true })

/** Back to the database's numbers for the grams. */
export const resetFoodMacros = (fd: FoodDraft): FoodDraft => (fd.ref ? recompute({ ...fd, manual: false }) : fd)

export const foodDraftMacros = (fd: Pick<FoodDraft, MacroField>): Macros => ({
  kcal: num(fd.kcal),
  protein: num(fd.protein),
  carbs: num(fd.carbs),
  fat: num(fd.fat),
})

/** A meal's totals in the editor: its foods when it has any, else the typed totals. */
export function mealDraftTotals(m: MealDraft): Macros {
  if (m.foods.length) return sumMacros(m.foods.map(foodDraftMacros))
  return foodDraftMacros(m)
}

/** The plan's day as the meals add up. */
export const draftPlanTotals = (meals: MealDraft[]): Macros => sumMacros(meals.map(mealDraftTotals))

export function draftFromPlan(p: MealPlan): PlanDraft {
  return {
    title: p.title,
    startDate: p.startDate,
    notes: p.notes,
    kcal: str(p.kcal),
    protein: str(p.protein),
    carbs: str(p.carbs),
    fat: str(p.fat),
    meals: p.meals.map(mealDraftFrom),
    files: [...p.files],
    active: p.active,
  }
}

export function emptyDraft(today: ISODate): PlanDraft {
  return { title: '', startDate: today, notes: '', kcal: '', protein: '', carbs: '', fat: '', meals: [], files: [], active: true }
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
  return {
    ...d,
    title: bumpTitle(prev.title),
    startDate: today,
    active: true,
    meals: d.meals.map((m) => ({ ...m, id: newId(), foods: m.foods.map((f) => ({ ...f, id: newId() })) })),
  }
}

/** kcal implied by macros (4 / 4 / 9 kcal per gram); null when no macro is filled in. */
export function kcalFromMacros(protein: number | null, carbs: number | null, fat: number | null): number | null {
  if (protein == null && carbs == null && fat == null) return null
  return Math.round((protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9)
}

export const draftMacroKcal = (d: Pick<PlanDraft, 'protein' | 'carbs' | 'fat'>): number | null =>
  kcalFromMacros(num(d.protein), num(d.carbs), num(d.fat))

/** Sum of the meals' kcal in a draft (foods included), or null when none has kcal. */
export const draftMealsKcal = (meals: MealDraft[]): number | null => draftPlanTotals(meals).kcal

export type FieldError = 'required' | 'number' | 'range' | 'time' | 'date'
export type MealField = 'name' | 'time' | MacroField
export type FoodField = 'name' | 'grams' | 'pieces' | MacroField
export interface DraftErrors {
  fields: Partial<Record<'title' | 'startDate' | TargetKey, FieldError>>
  meals: Record<string, Partial<Record<MealField, FieldError>>>
  /** By food id. */
  foods: Record<string, Partial<Record<FoodField, FieldError>>>
}

const LIMITS: Record<TargetKey, number> = {
  kcal: 10000,
  protein: 1000,
  carbs: 1500,
  fat: 1000,
}
/** Per meal or per food. */
const PORTION_LIMITS: Record<MacroField | 'grams' | 'pieces', number> = { kcal: 5000, protein: 500, carbs: 1000, fat: 500, grams: 5000, pieces: 100 }

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
  const foods: DraftErrors['foods'] = {}
  for (const m of d.meals) {
    const e: DraftErrors['meals'][string] = {}
    if (!m.name.trim()) e.name = 'required'
    if (m.time.trim() && mealMinutes(m.time) == null) e.time = 'time'
    // With a food list the typed totals are not used (and not shown).
    if (!m.foods.length) {
      for (const k of MACRO_FIELDS) {
        const err = checkNum(m[k], PORTION_LIMITS[k])
        if (err) e[k] = err
      }
    }
    if (Object.keys(e).length) meals[m.id] = e
    for (const fd of m.foods) {
      const fe: DraftErrors['foods'][string] = {}
      if (!fd.name.trim()) fe.name = 'required'
      for (const k of ['grams', 'pieces', ...MACRO_FIELDS] as const) {
        const err = checkNum(fd[k], PORTION_LIMITS[k])
        if (err) fe[k] = err
      }
      if (Object.keys(fe).length) foods[fd.id] = fe
    }
  }
  return { fields, meals, foods }
}

export const hasErrors = (e: DraftErrors): boolean =>
  Object.keys(e.fields).length > 0 || Object.keys(e.meals).length > 0 || Object.keys(e.foods).length > 0

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
    meals: d.meals.map((m) => {
      const meal: Meal = {
        id: m.id,
        name: m.name.trim(),
        time: normTime(m.time),
        items: items(m.items),
        kcal: num(m.kcal),
        protein: num(m.protein),
        carbs: num(m.carbs),
        fat: num(m.fat),
      }
      if (!m.foods.length) return meal
      return withDerivedTotals({ ...meal, foods: m.foods.map(foodFromDraft) })
    }),
    files: d.files,
    active: d.active,
    updatedAt: 0,
  }
}

function foodFromDraft(fd: FoodDraft): MealFood {
  const food = foodById(fd.ref)
  const pieces = food?.unit ? num(fd.pieces) : null
  const out: MealFood = {
    id: fd.id,
    name: fd.name.trim(),
    grams: num(fd.grams),
    ...foodDraftMacros(fd),
    ref: food ? food.id : null,
  }
  if (pieces != null) out.pieces = pieces
  return out
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
