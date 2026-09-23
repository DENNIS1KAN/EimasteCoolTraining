import type { Lang } from '../../../i18n'
import { FOODS } from './data'
import type { Food, Macros, UnitKind } from './types'

export { FOODS } from './data'
export type { Food, FoodUnit, Macros, UnitKind } from './types'

const BY_ID = new Map(FOODS.map((f) => [f.id, f]))
export const foodById = (id: string | null | undefined): Food | null => (id ? (BY_ID.get(id) ?? null) : null)

/* ------------------------------------------------------------------ search */

/** Lowercase, no accents or diaeresis, final sigma folded: "Γιαούρτι" -> "γιαουρτι". */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ς/g, 'σ')
}

const GREEKLISH: [RegExp, string][] = [
  [/ου/g, 'ou'],
  [/αι/g, 'ai'],
  [/ει/g, 'ei'],
  [/οι/g, 'oi'],
  [/μπ/g, 'b'],
  [/ντ/g, 'd'],
  [/γκ/g, 'g'],
  [/θ/g, 'th'],
  [/ψ/g, 'ps'],
  [/ξ/g, 'x'],
  [/χ/g, 'ch'],
]
const LETTERS: Record<string, string> = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n',
  ο: 'o', π: 'p', ρ: 'r', σ: 's', τ: 't', υ: 'y', φ: 'f', ω: 'o',
}

/**
 * Greek -> Latin, the way people type Greek on a Latin keyboard ("κοτόπουλο" -> "kotopoulo"). People spell υ as
 * y or i and χ as ch, x or h, so every spelling is returned.
 */
export function greeklish(folded: string): string[] {
  let s = folded
  for (const [re, to] of GREEKLISH) s = s.replace(re, to)
  const base = s.replace(/[α-ω]/g, (c) => LETTERS[c] ?? c)
  const alt = base.replace(/y/g, 'i')
  return [...new Set([base, alt, alt.replace(/ch/g, 'x'), alt.replace(/ch/g, 'h')])]
}

const words = (s: string): string[] => s.split(/[^\p{L}\p{N}%]+/u).filter(Boolean)

interface Indexed {
  food: Food
  /** Folded names (en, el) for exact / starts-with matches. */
  names: string[]
  /** Every searchable word: both names, aliases and the Greeklish of the Greek name. */
  words: string[]
}

let INDEX: Indexed[] | null = null
function index(): Indexed[] {
  INDEX ??= FOODS.map((food) => {
    const en = fold(food.en)
    const el = fold(food.el)
    // Latin aliases in both common spellings of υ (tyri / tiri)
    const alias = (food.aliases ?? []).map(fold).flatMap((a) => [a, a.replace(/y/g, 'i')])
    const all = [en, el, ...greeklish(el), ...alias]
    return { food, names: [en, el], words: [...new Set(all.flatMap(words))] }
  })
  return INDEX
}

/**
 * Foods matching a query typed in English, Greek or Greeklish, with or without accents. Every word of the query
 * must start a word of the food (names or aliases); names that start with the query rank first, then the viewer's
 * language, then shorter names.
 */
export function searchFoods(query: string, lang: Lang = 'en', limit = 8): Food[] {
  const q = fold(query).trim()
  if (!q) return []
  const qWords = words(q)
  if (!qWords.length) return []
  const scored: { food: Food; score: number; len: number }[] = []
  for (const it of index()) {
    if (!qWords.every((w) => it.words.some((x) => x.startsWith(w)))) continue
    const own = fold(lang === 'el' ? it.food.el : it.food.en)
    let score = 0
    if (it.names.includes(q)) score += 100
    if (own.startsWith(q)) score += 60
    else if (it.names.some((n) => n.startsWith(q))) score += 40
    // the first word of the query starts the name's first word ("chicken" before "... with chicken")
    if (it.names.some((n) => words(n)[0]?.startsWith(qWords[0]))) score += 20
    // whole-word matches beat prefixes ("egg" -> "Egg" before "Eggplant")
    score += qWords.filter((w) => it.words.includes(w)).length * 5
    scored.push({ food: it.food, score, len: own.length })
  }
  scored.sort((a, b) => b.score - a.score || a.len - b.len)
  return scored.slice(0, limit).map((s) => s.food)
}

/* ------------------------------------------------------------------ macros */

const r0 = (x: number) => Math.round(x)
const r1 = (x: number) => Math.round(x * 10) / 10

/** Macros of a portion of a database food: kcal to the whole number, grams to one decimal. */
export function macrosFor(food: Pick<Food, 'kcal' | 'protein' | 'carbs' | 'fat'>, grams: number): Macros {
  const k = Math.max(0, grams) / 100
  return { kcal: r0(food.kcal * k), protein: r1(food.protein * k), carbs: r1(food.carbs * k), fat: r1(food.fat * k) }
}

/** The food's name in a language (database foods only). */
export const foodName = (food: Food, lang: Lang): string => (lang === 'el' ? food.el : food.en)

/**
 * The name to show for a food of a meal: a database food whose name was left as picked follows the viewer's
 * language; a renamed or custom food shows what the coach typed.
 */
export function displayFoodName(item: { name: string; ref?: string | null }, lang: Lang): string {
  const food = foodById(item.ref)
  if (food && (item.name === food.en || item.name === food.el || !item.name.trim())) return foodName(food, lang)
  return item.name
}

const UNIT_LABELS: Record<UnitKind, { en: [string, string]; el: [string, string] }> = {
  piece: { en: ['pc', 'pcs'], el: ['τεμ.', 'τεμ.'] },
  slice: { en: ['slice', 'slices'], el: ['φέτα', 'φέτες'] },
  tbsp: { en: ['tbsp', 'tbsp'], el: ['κ.σ.', 'κ.σ.'] },
  tsp: { en: ['tsp', 'tsp'], el: ['κ.γ.', 'κ.γ.'] },
  scoop: { en: ['scoop', 'scoops'], el: ['μεζούρα', 'μεζούρες'] },
  skewer: { en: ['skewer', 'skewers'], el: ['καλαμάκι', 'καλαμάκια'] },
  cup: { en: ['cup', 'cups'], el: ['φλιτζάνι', 'φλιτζάνια'] },
}

/** "2 pcs", "1 tbsp", "3 φέτες". */
export function unitLabel(kind: UnitKind, n: number, lang: Lang): string {
  const [one, other] = UNIT_LABELS[kind][lang]
  return n === 1 ? one : other
}
