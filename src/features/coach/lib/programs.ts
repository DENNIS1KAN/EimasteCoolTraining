/** Program helpers for the coach console: summaries, ids for imports, assignments and the weekly pattern. */
import type { Member, Program } from '../../../data/types'
import type { ISODate } from '../../../lib/dates'
import { addDays, fromISODate } from '../../../lib/dates'
import { dayShortName } from '../../../data/programs'
import { upperText } from '../../../lib/text'
import { toHandle } from './handle'

export interface ProgramSummary {
  weeks: number
  /** Most training days in any week. */
  daysPerWeek: number
  workouts: number
  /** Exercise slots across the whole program. */
  exerciseSlots: number
  /** Distinct exercise names (main exercises only). */
  uniqueExercises: number
  /** Exercises in one typical (first) week. */
  exercisesPerWeek: number
  blocks: string[]
}

export function programSummary(p: Pick<Program, 'weeks'>): ProgramSummary {
  const names = new Set<string>()
  let slots = 0
  let workouts = 0
  const blocks: string[] = []
  for (const w of p.weeks) {
    if (w.block && !blocks.includes(w.block)) blocks.push(w.block)
    for (const d of w.days) {
      workouts++
      for (const e of d.ex) {
        slots++
        if (e.n.trim()) names.add(e.n.trim().toLowerCase())
      }
    }
  }
  return {
    weeks: p.weeks.length,
    daysPerWeek: Math.max(0, ...p.weeks.map((w) => w.days.length)),
    workouts,
    exerciseSlots: slots,
    uniqueExercises: names.size,
    exercisesPerWeek: p.weeks[0]?.days.reduce((a, d) => a + d.ex.length, 0) ?? 0,
    blocks,
  }
}

/** Short random suffix (base 36). */
export const shortRandom = (len = 5): string => {
  let s = ''
  while (s.length < len) s += Math.random().toString(36).slice(2)
  return s.slice(0, len)
}

/** id for an imported program: slug of the name + '-' + short random ("summer-cut-k3x9q"). */
export function programIdFromName(name: string, random: string = shortRandom()): string {
  const slug = toHandle(name).slice(0, 40).replace(/-+$/, '') || 'program'
  return `${slug}-${random}`
}

export const membersOnProgram = (members: Member[], programId: string): Member[] => members.filter((m) => m.programId === programId)

/** Programs: built-in first, then imported ones by name. */
export const sortPrograms = (ps: Program[]): Program[] =>
  [...ps].sort((a, b) => (a.builtIn === b.builtIn ? a.name.localeCompare(b.name) : a.builtIn ? -1 : 1))

export interface PatternSlot {
  /** 0 = first day of each program week (a Monday when the program starts on a Monday). */
  slot: number
  /** Index of the program day trained in this slot, null for rest. */
  day: number | null
  /** Short day name ("Upper"), "" for rest. */
  label: string
}

/** The 7-slot weekly pattern with the day names of week 1. */
export function weeklyPattern(p: Pick<Program, 'schedule' | 'weeks'>): PatternSlot[] {
  const days = p.weeks[0]?.days ?? []
  return Array.from({ length: 7 }, (_, slot) => {
    const day = p.schedule[slot] ?? null
    const d = day != null ? days[day] : undefined
    return { slot, day: d ? day : null, label: d ? dayShortName(d) : '' }
  })
}

/** Last day of the program (inclusive) for a start date. */
export const programEnd = (p: Pick<Program, 'weeks'>, start: ISODate): ISODate => addDays(start, Math.max(1, p.weeks.length) * 7 - 1)

/** 0 = Monday … 6 = Sunday */
export const weekdayIndex = (d: ISODate): number => (fromISODate(d).getDay() + 6) % 7

/** "8-10" -> "8–10" (en dash between numbers); trims. */
export const enDash = (s: string | undefined): string => (s ?? '').trim().replace(/(\d)\s*-\s*(?=\d)/g, '$1–')

/** "~8-9" -> { approx: true, value: "8–9" } so the tilde can be typeset apart from condensed numerals. */
export function splitApprox(s: string | undefined): { approx: boolean; value: string } {
  const v = enDash(s)
  return v.startsWith('~') ? { approx: true, value: v.slice(1).trim() } : { approx: false, value: v }
}

/** "N/A", "none", "-" and empty mean no last-set technique. */
export const techniqueOf = (t: string | undefined): string | null => {
  const v = (t ?? '').trim()
  return !v || /^(n\/?a|none|-|–)$/i.test(v) ? null : v
}

/** Short focus tag for a day tab: "Upper (Strength Focus)" -> "STR"; "" when the day has no focus. */
export function focusAbbr(dayName: string): string {
  const focus = (dayName.match(/\(([^)]+)\)/) || [])[1]?.trim() ?? ''
  const word = focus.split(/\s+/)[0] ?? ''
  return upperText(Array.from(word).slice(0, 3).join(''))
}

export interface BlockGroup {
  block: string
  /** 1-based week numbers, consecutive. */
  weeks: number[]
}

/** Consecutive weeks sharing a block label: [{ block: 'Foundation', weeks: [1..5] }, { block: 'Ramping', weeks: [6..12] }]. */
export function blockGroups(p: Pick<Program, 'weeks'>): BlockGroup[] {
  const out: BlockGroup[] = []
  p.weeks.forEach((w, i) => {
    const last = out[out.length - 1]
    if (last && last.block === w.block) last.weeks.push(i + 1)
    else out.push({ block: w.block, weeks: [i + 1] })
  })
  return out
}
