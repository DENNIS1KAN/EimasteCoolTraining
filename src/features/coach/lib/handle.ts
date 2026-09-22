/**
 * Member handles ("stelios"): url-safe, lowercase a-z0-9 and dashes. They appear in invite links and
 * derive the login e-mail, so Greek names are transliterated to Latin (ELOT 743 style, simplified).
 */

const DIGRAPHS: [RegExp, string][] = [
  // word-initial nasal clusters read as voiced stops: Μπάμπης -> bampis, Ντίνος -> dinos, Γκίκας -> gkikas
  [/(^|[^α-ω])μπ/g, '$1b'],
  [/(^|[^α-ω])ντ/g, '$1d'],
  [/γγ/g, 'ng'],
  [/γξ/g, 'nx'],
  [/γχ/g, 'nch'],
  [/ου/g, 'ou'],
  [/αι/g, 'ai'],
  [/ει/g, 'ei'],
  [/οι/g, 'oi'],
  // αυ/ευ/ηυ: "v" before vowels and voiced consonants, "f" before voiceless ones and at the end
  [/([αεη])υ(?=[θκξπσςτφχψ]|$|[^α-ω])/g, '$1f'],
  [/([αεη])υ/g, '$1v'],
]

const LETTERS: Record<string, string> = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n',
  ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
}

/** Greek (monotonic or polytonic) to Latin; other characters pass through. */
export function transliterate(text: string): string {
  // strip accents and diaeresis first so "ά" and "ϊ" behave like their base letters
  let s = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  for (const [re, to] of DIGRAPHS) s = s.replace(re, to)
  return s.replace(/[α-ως]/g, (c) => LETTERS[c] ?? c)
}

export const HANDLE_MAX = 24

/** "Στέλιος Κ." -> "stelios-k"; "  Dennis!! " -> "dennis". Empty when nothing usable is left. */
export function toHandle(name: string): string {
  return transliterate(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, HANDLE_MAX)
    .replace(/-+$/g, '')
}

/** Valid handle: 2-24 chars of a-z, 0-9 and single inner dashes. */
export const isValidHandle = (s: string): boolean => s.length >= 2 && s.length <= HANDLE_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)

/** Clean up what the coach types into the handle field (keeps a trailing dash while typing). */
export const cleanHandleInput = (s: string): string =>
  transliterate(s)
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, HANDLE_MAX)

/** First free variant of a handle: "nikos", "nikos-2", "nikos-3", … */
export function uniqueHandle(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const root = base || 'member'
  if (!used.has(root)) return root
  for (let i = 2; ; i++) {
    const suffix = `-${i}`
    const candidate = root.slice(0, HANDLE_MAX - suffix.length).replace(/-+$/, '') + suffix
    if (!used.has(candidate)) return candidate
  }
}
