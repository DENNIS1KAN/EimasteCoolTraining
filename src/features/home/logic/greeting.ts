export type DayPart = 'morning' | 'afternoon' | 'evening'

/**
 * Part of the day for the greeting: morning until 12:00, afternoon until 18:00, then evening.
 * The small hours (00:00-04:59) still count as evening: a late session, not an early morning.
 */
export function dayPart(hour: number): DayPart {
  const h = ((Math.floor(hour) % 24) + 24) % 24
  if (h < 5) return 'evening'
  if (h < 12) return 'morning'
  return h < 18 ? 'afternoon' : 'evening'
}

/** The first word of a name ("Stelios Papadopoulos" -> "Stelios"), or the name itself. */
export function firstName(name: string): string {
  const n = name.trim()
  return n.split(/\s+/)[0] || n
}

/** The name to greet someone with: their first name. */
export const greetName = (name: string): string => firstName(name)
