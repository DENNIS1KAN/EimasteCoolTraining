import type { Lang } from '../../../i18n'

export type DayPart = 'morning' | 'afternoon' | 'evening'

/**
 * Part of the day for the greeting. English switches at 12:00 and 18:00. Greek has only two everyday
 * greetings: Καλημέρα until about 13:00, then Καλησπέρα (the "afternoon" and "evening" slots share it).
 * The small hours (00:00-04:59) still count as evening: a late session, not an early morning.
 */
export function dayPart(hour: number, lang: Lang): DayPart {
  const h = ((Math.floor(hour) % 24) + 24) % 24
  if (h < 5) return 'evening'
  if (h < (lang === 'el' ? 13 : 12)) return 'morning'
  return h < 18 ? 'afternoon' : 'evening'
}

/** The first word of a name ("Stelios Papadopoulos" -> "Stelios"), or the name itself. */
export function firstName(name: string): string {
  const n = name.trim()
  return n.split(/\s+/)[0] || n
}

const GREEK = /[Ͱ-Ͽἀ-῿]/

/**
 * Greek vocative for everyday first names, as friends say it: Στέλιος -> Στέλιο, Θάνος -> Θάνο,
 * Κώστας -> Κώστα, Γιάννης -> Γιάννη, Παντελής -> Παντελή. Names in Latin letters ("Stelios") and names
 * that don't decline (Μαρία, Ντένις) are returned unchanged.
 */
export function vocative(name: string): string {
  if (!GREEK.test(name) || name.length < 3) return name
  const m = name.match(/^(.*)(ος|ός|ας|άς|ης|ής|ούς|ους)$/)
  if (!m) return name
  const [, stem, end] = m
  const map: Record<string, string> = { ος: 'ο', ός: 'ό', ας: 'α', άς: 'ά', ης: 'η', ής: 'ή', ους: 'ου', ούς: 'ού' }
  return stem + map[end]
}

/** The name to greet someone with in a language: first name, in the vocative for Greek. */
export const greetName = (name: string, lang: Lang): string => (lang === 'el' ? vocative(firstName(name)) : firstName(name))
