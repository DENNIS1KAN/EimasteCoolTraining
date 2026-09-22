import type { Program } from '../../data/types'
import { useT } from '../../i18n'
import { M } from './messages'

/** "BTS · 12 weeks" -> { base: 'BTS', weeks: 12 }; other names -> null. */
export function splitProgramName(name: string): { base: string; weeks: number } | null {
  const m = name.match(/^(.*\S)\s*·\s*(\d+)\s*weeks?$/i)
  return m ? { base: m[1], weeks: Number(m[2]) } : null
}

/** A program's name in the UI language: "BTS · 12 weeks" reads "BTS · 12 εβδομάδες" in Greek; custom names as written. */
export function useProgramName(p: Pick<Program, 'name'>): string {
  const t = useT(M)
  const s = splitProgramName(p.name)
  return s ? `${s.base} · ${t('weeksN', { n: s.weeks })}` : p.name
}

/** Block labels of the built-in program ("Foundation", "Ramping") translated; custom blocks as written. */
export function useBlockLabel(): (label: string) => string {
  const t = useT(M)
  return (label) => {
    const k = label.trim().toLowerCase()
    return k === 'foundation' ? t('blockFoundation') : k === 'ramping' ? t('blockRamping') : label
  }
}
