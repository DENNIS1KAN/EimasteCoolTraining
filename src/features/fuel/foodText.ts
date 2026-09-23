import type { Lang } from '../../i18n'
import type { MealFood } from '../../data/types'
import { fmtNum } from '../../lib/format'
import { foodById, unitLabel } from './foods'

/** "300 g", "2 pcs · 100 g", "1 tbsp · 13.5 g", or "" for a custom food without a weight. */
export function amountText(f: Pick<MealFood, 'grams' | 'pieces' | 'ref'>, lang: Lang): string {
  const unit = foodById(f.ref)?.unit
  const grams = f.grams != null ? `${fmtNum(f.grams, 1)} g` : ''
  if (unit && f.pieces != null && f.pieces > 0) {
    const pcs = `${fmtNum(f.pieces, 1)} ${unitLabel(unit.kind, f.pieces, lang)}`
    return grams ? `${pcs} · ${grams}` : pcs
  }
  return grams
}
