/** Coach data exports: a full JSON backup of every table, and workout history as CSV. */
import type { Member, Program, Snapshot, WorkoutLog } from '../../../data/types'
import { TABLES } from '../../../data/types'
import { exportLogbookCSV } from '../../../lib/import/logbook'
import { parseCSV, toCSV } from '../../../lib/import/csv'

export const BACKUP_FORMAT = 'eimaste-cool-training/backup'
export const BACKUP_VERSION = 1

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  /** Built-in programs ship with the app and are left out. */
  tables: Snapshot
}

type Tables = { [K in keyof Snapshot]: Record<string, Snapshot[K][number]> }

/** Every table as arrays (built-in programs excluded), with a small header describing the file. */
export function buildBackup(tables: Tables, now: Date = new Date()): Backup {
  const out = {} as Record<keyof Snapshot, unknown[]>
  for (const t of TABLES) {
    const rows = Object.values(tables[t]) as { id: string }[]
    out[t] = rows.filter((r) => t !== 'programs' || !(r as unknown as Program).builtIn).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), tables: out as unknown as Snapshot }
}

export const backupJSON = (tables: Tables, now?: Date): string => JSON.stringify(buildBackup(tables, now), null, 2)

/**
 * Workout history as CSV. For one member it is exactly the logbook format (it can be imported back);
 * for several members a leading "member" column (the handle) tells the rows apart.
 */
export function workoutsCSV(
  logs: readonly WorkoutLog[],
  programs: Readonly<Record<string, Program>>,
  members: readonly Member[],
  opts: { bom?: boolean } = {},
): string {
  if (members.length === 1) {
    const id = members[0].id
    return exportLogbookCSV(
      logs.filter((l) => l.memberId === id),
      programs,
      opts,
    )
  }
  let header: string[] | null = null
  const rows: string[][] = []
  for (const m of members) {
    const csv = exportLogbookCSV(
      logs.filter((l) => l.memberId === m.id),
      programs,
    )
    const [head, ...body] = parseCSV(csv)
    header ??= ['member', ...head]
    for (const r of body) rows.push([m.slug, ...r])
  }
  if (!header) header = ['member', ...parseCSV(exportLogbookCSV([], programs))[0]]
  return toCSV([header, ...rows], opts)
}

/** "ect-backup-2026-09-22.json" */
export const exportFileName = (kind: string, date: string, ext: string): string => `ect-${kind}-${date}.${ext}`
