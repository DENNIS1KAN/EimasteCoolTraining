/** How a food is counted when it is not weighed: "2 eggs", "1 tbsp olive oil", "3 slices". */
export type UnitKind = 'piece' | 'slice' | 'tbsp' | 'tsp' | 'scoop' | 'skewer' | 'cup'

export interface FoodUnit {
  kind: UnitKind
  /** Grams in one unit (edible part). */
  g: number
}

/** A food in the built-in database. Macros are per 100 g of the food as described (cooked or raw). */
export interface Food {
  /** Stable id, stored in meal plans (MealFood.ref): never rename one. */
  id: string
  en: string
  el: string
  /** Extra search words: other names, brands of a kind, Greeklish spellings. */
  aliases?: string[]
  kcal: number
  protein: number
  carbs: number
  fat: number
  /** Default unit for foods usually counted by the piece or spoon. */
  unit?: FoodUnit
}

export interface Macros {
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}
