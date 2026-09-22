import type { Cheer, MealPlan, Member, NutritionCheckin, Program, WeightEntry, WorkoutLog } from '../../data/types'
import { exportLogbookCSV } from '../../lib/import/logbook'

/** The tables an export reads (structurally the store's state). */
export interface ExportTables {
  logs: Record<string, WorkoutLog>
  weights: Record<string, WeightEntry>
  mealPlans: Record<string, MealPlan>
  checkins: Record<string, NutritionCheckin>
  cheers: Record<string, Cheer>
  programs: Record<string, Program>
}

export interface MyDataExport {
  app: 'eimaste-cool-training'
  format: 1
  version: string
  exportedAt: string
  member: Member
  logs: WorkoutLog[]
  weights: WeightEntry[]
  mealPlans: MealPlan[]
  checkins: NutritionCheckin[]
  cheers: Cheer[]
  /** Programs referenced by the logs that are not built into the app. */
  programs: Program[]
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const mine = <T extends { memberId: string; id: string }>(rows: Record<string, T>, id: string): T[] =>
  Object.values(rows)
    .filter((r) => r.memberId === id)
    .sort(byId)

/** Everything that belongs to one member: their profile, logs, weigh-ins, plans, check-ins and cheers. */
export function buildMyData(me: Member, t: ExportTables, version: string, now = Date.now()): MyDataExport {
  const logs = mine(t.logs, me.id)
  const used = new Set(logs.map((l) => l.programId))
  return {
    app: 'eimaste-cool-training',
    format: 1,
    version,
    exportedAt: new Date(now).toISOString(),
    member: me,
    logs,
    weights: mine(t.weights, me.id).sort((a, b) => (a.date < b.date ? -1 : 1)),
    mealPlans: mine(t.mealPlans, me.id),
    checkins: mine(t.checkins, me.id).sort((a, b) => (a.date < b.date ? -1 : 1)),
    cheers: Object.values(t.cheers)
      .filter((c) => c.fromId === me.id || c.toId === me.id)
      .sort((a, b) => a.createdAt - b.createdAt),
    programs: Object.values(t.programs).filter((p) => !p.builtIn && used.has(p.id)),
  }
}

/** My workouts in the old logbook's CSV format (with a BOM so Excel reads Greek correctly). */
export function myWorkoutsCSV(me: Member, t: Pick<ExportTables, 'logs' | 'programs'>): string {
  return exportLogbookCSV(mine(t.logs, me.id), t.programs, { bom: true })
}

/** "eimaste-cool-stelios-2026-09-22.json" */
export const exportFileName = (slug: string, date: string, kind: 'data' | 'workouts'): string =>
  `eimaste-cool-${slug}${kind === 'workouts' ? '-workouts' : ''}-${date}.${kind === 'workouts' ? 'csv' : 'json'}`

/** Save text as a file through a temporary link (works in every browser, including iOS Safari). */
export function downloadText(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
