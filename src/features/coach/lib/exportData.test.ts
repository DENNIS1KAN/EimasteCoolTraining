import { describe, expect, it } from 'vitest'
import { BTS_PROGRAM } from '../../../data/programs'
import { parseCSV } from '../../../lib/import/csv'
import { MINI, mkLog, mkMember, mkWeight, squad } from '../../../lib/testing/fixtures'
import { BACKUP_FORMAT, backupJSON, buildBackup, exportFileName, workoutsCSV } from './exportData'

const a = mkMember({ id: 'a', slug: 'alex' })
const b = mkMember({ id: 'b', slug: 'bea' })
const logs = [
  mkLog({ member: 'a', week: 1, day: 0, ex: { 0: { sets: [['50', '10'], ['50', '9']] } } }),
  mkLog({ member: 'b', week: 1, day: 1, ex: { 0: { sets: [['80', '5']] } } }),
]

describe('buildBackup', () => {
  it('includes every table and leaves built-in programs out', () => {
    const d = squad({ members: [a, b], programs: [MINI, BTS_PROGRAM], logs, weights: [mkWeight('a', '2026-01-05', 80)] })
    const bk = buildBackup(d, new Date('2026-09-22T10:00:00Z'))
    expect(bk.format).toBe(BACKUP_FORMAT)
    expect(bk.exportedAt).toBe('2026-09-22T10:00:00.000Z')
    expect(bk.tables.members.map((m) => m.id)).toEqual(['a', 'b'])
    expect(bk.tables.programs.map((p) => p.id)).toEqual(['mini'])
    expect(bk.tables.logs).toHaveLength(2)
    expect(bk.tables.weights).toHaveLength(1)
    expect(bk.tables.cheers).toEqual([])
    expect(JSON.parse(backupJSON(d)).tables.members).toHaveLength(2)
  })
})

describe('workoutsCSV', () => {
  const programs = { [MINI.id]: MINI }
  it('adds a member column for several members', () => {
    const rows = parseCSV(workoutsCSV(logs, programs, [a, b]))
    expect(rows[0][0]).toBe('member')
    expect(rows[0][1]).toBe('week')
    expect(rows.slice(1).map((r) => r[0])).toEqual(['alex', 'alex', 'bea'])
  })
  it('is the plain logbook format for one member', () => {
    const rows = parseCSV(workoutsCSV(logs, programs, [b]))
    expect(rows[0][0]).toBe('week')
    expect(rows).toHaveLength(2)
  })
  it('writes just a header when there is nothing', () => {
    const rows = parseCSV(workoutsCSV([], programs, [a, b]))
    expect(rows).toHaveLength(1)
    expect(rows[0][0]).toBe('member')
    expect(parseCSV(workoutsCSV([], programs, []))[0][0]).toBe('member')
  })
  it('can prepend a BOM for Excel', () => {
    expect(workoutsCSV(logs, programs, [a], { bom: true }).charCodeAt(0)).toBe(0xfeff)
  })
})

it('exportFileName', () => {
  expect(exportFileName('backup', '2026-09-22', 'json')).toBe('ect-backup-2026-09-22.json')
})
