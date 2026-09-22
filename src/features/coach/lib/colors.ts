import { MEMBER_COLORS, type MemberColor } from '../../../data/types'

type Wearer = { id: string; name: string; color: MemberColor }

/** Colors worn by members other than `exceptId` (color -> first wearer's name). */
export function usedColors(members: readonly Wearer[], exceptId?: string): Map<MemberColor, string> {
  const m = new Map<MemberColor, string>()
  for (const x of members) if (x.id !== exceptId && !m.has(x.color)) m.set(x.color, x.name)
  return m
}

/** The first identity color nobody wears yet (in the validated order), else the least used one. */
export function firstFreeColor(members: readonly Wearer[]): MemberColor {
  const count = new Map<MemberColor, number>(MEMBER_COLORS.map((c) => [c, 0]))
  for (const m of members) count.set(m.color, (count.get(m.color) ?? 0) + 1)
  let best = MEMBER_COLORS[0]
  for (const c of MEMBER_COLORS) if ((count.get(c) ?? 0) < (count.get(best) ?? 0)) best = c
  return best
}
