import type { MemberColor } from '../data/types'
import { upperText } from '../lib/text'

/** CSS color for a member identity color (follows the theme). */
export const memberColorVar = (c: MemberColor | string | undefined): string => `var(--m-${c || 'blue'})`

/** Initials for avatars: "Stelios" -> "S", "Thanos K" -> "TK", "Άρης" -> "Α" (Greek capitals drop the tonos) */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return upperText(parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : ''))
}
