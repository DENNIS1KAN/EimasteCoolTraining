/** Text helpers that must follow Greek typography rules. */

const GREEK = /[Ͱ-Ͽἀ-῿]/

export const hasGreek = (s: string): boolean => GREEK.test(s)

/**
 * The language of a free-text string (a day, exercise or member name) for its `lang` attribute: 'el' when it has
 * Greek letters (so CSS text-transform: uppercase drops the tonos: "ΠΟΔΙΑ", not "ΠΌΔΙΑ"), else 'en'.
 */
export const textLang = (s: string): 'el' | 'en' => (GREEK.test(s) ? 'el' : 'en')

/** Uppercase that follows Greek rules (no tonos on capitals: "Ώμοι" -> "ΩΜΟΙ", "ΐ" -> "Ϊ"); Latin is untouched. */
export function upperText(s: string): string {
  if (!GREEK.test(s)) return s.toUpperCase()
  return s
    .normalize('NFD')
    .replace(/([Ͱ-Ͽἀ-῿][̀-ͯ]*?)[́͂̓̔]/g, '$1')
    .normalize('NFC')
    .toLocaleUpperCase('el')
}
