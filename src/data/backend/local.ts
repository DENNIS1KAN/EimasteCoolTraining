import { createDemoSnapshot } from '../demo/seed'
import type { ChangeEvent, FileRef, LoginProfile, Member, MemberColor, Snapshot, TableName, Tables } from '../types'
import { TABLES } from '../types'
import { todayISO } from '../../lib/dates'
import { uuid } from '../../lib/ids'
import type { Backend } from './types'
import { BackendError } from './types'
import { idbDelete, idbGet, idbPut } from './idb'
import { defaultMemberProfile } from './supabase-map'

const DB_KEY = 'ect-demo-db-v1'
const ME_KEY = 'ect-demo-me'
const MAX_FILE = 15 * 1024 * 1024

type Db = { [T in TableName]: Record<string, Tables[T]> } & { invites: Record<string, string> }

/**
 * Demo mode: a complete, single-device backend. Anyone can "sign in" as any member without a password,
 * which also lets the owner preview what each friend will see.
 */
export class LocalBackend implements Backend {
  readonly kind = 'demo' as const
  private db: Db
  private listeners = new Set<(e: ChangeEvent) => void>()
  private objectUrls = new Map<string, string>()

  constructor() {
    this.db = this.read() ?? this.seed()
  }

  private read(): Db | null {
    try {
      const raw = localStorage.getItem(DB_KEY)
      if (!raw) return null
      const d = JSON.parse(raw)
      if (!d || typeof d !== 'object' || !d.members) return null
      for (const t of TABLES) d[t] = d[t] || {}
      d.invites = d.invites || {}
      return d as Db
    } catch {
      return null
    }
  }

  private seed(): Db {
    const snap = createDemoSnapshot(todayISO(), Date.now())
    const db = { invites: {} } as unknown as Db
    const snapByTable = snap as unknown as Record<TableName, { id: string }[]>
    for (const t of TABLES) (db as unknown as Record<string, Record<string, unknown>>)[t] = Object.fromEntries(snapByTable[t].map((r) => [r.id, r]))
    for (const m of snap.members) db.invites[m.id] = Math.random().toString(36).slice(2, 8).toUpperCase()
    this.db = db
    this.write()
    return db
  }

  private write() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this.db))
    } catch {
      /* storage full or blocked: demo keeps working in memory */
    }
  }

  /**
   * Wipe demo data and start again (from Settings). Without demo data the squad looks like a fresh setup:
   * the same people, with the profile a new member gets (no goals, start date, notes or remembered machines).
   */
  reset(withDemoData = true): void {
    try {
      localStorage.removeItem(DB_KEY)
    } catch {
      /* ignore */
    }
    this.db = this.seed()
    if (!withDemoData) {
      for (const t of TABLES) if (t !== 'members') (this.db as unknown as Record<string, object>)[t] = {}
      const now = Date.now()
      for (const m of Object.values(this.db.members)) {
        const { name: _name, color: _color, competes: _competes, ...fresh } = defaultMemberProfile(m.role, m.slug)
        Object.assign(m, fresh, { updatedAt: now })
      }
      this.write()
    }
  }

  async init(): Promise<string | null> {
    try {
      const id = localStorage.getItem(ME_KEY)
      return id && this.db.members[id] ? id : null
    } catch {
      return null
    }
  }

  async loginProfiles(): Promise<LoginProfile[]> {
    return Object.values(this.db.members).map((m) => ({ id: m.id, slug: m.slug, name: m.name, color: m.color, role: m.role, joined: true }))
  }

  async signIn(slug: string): Promise<string> {
    const m = Object.values(this.db.members).find((x) => x.slug === slug)
    if (!m) throw new BackendError('not_found', 'No such member')
    try {
      localStorage.setItem(ME_KEY, m.id)
    } catch {
      /* ignore */
    }
    return m.id
  }

  async join(slug: string): Promise<string> {
    return this.signIn(slug)
  }

  async signOut(): Promise<void> {
    try {
      localStorage.removeItem(ME_KEY)
    } catch {
      /* ignore */
    }
  }

  async changePassword(): Promise<void> {
    /* demo mode has no passwords */
  }

  onSignedOut(): () => void {
    return () => {}
  }

  async loadAll(): Promise<Snapshot> {
    const clone = <T,>(o: Record<string, T>): T[] => Object.values(o).map((x) => structuredClone(x))
    return {
      members: clone(this.db.members),
      programs: clone(this.db.programs),
      logs: clone(this.db.logs),
      weights: clone(this.db.weights),
      mealPlans: clone(this.db.mealPlans),
      checkins: clone(this.db.checkins),
      cheers: clone(this.db.cheers),
    }
  }

  async put<T extends TableName>(table: T, row: Tables[T]): Promise<void> {
    ;(this.db[table] as Record<string, Tables[T]>)[row.id] = structuredClone(row)
    this.write()
  }

  async remove(table: TableName, id: string): Promise<void> {
    delete (this.db[table] as Record<string, unknown>)[id]
    this.write()
  }

  subscribe(cb: (e: ChangeEvent) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  async uploadFile(memberId: string, file: File): Promise<FileRef> {
    if (file.size > MAX_FILE) throw new BackendError('too_large', 'File is larger than 15 MB')
    const path = `${memberId}/${uuid()}-${file.name.replace(/[^\w.-]+/g, '_')}`
    try {
      await idbPut(path, file)
    } catch {
      throw new BackendError('unknown', 'This browser blocked file storage')
    }
    return { path, name: file.name, type: file.type || 'application/octet-stream', size: file.size }
  }

  async fileUrl(ref: FileRef): Promise<string> {
    const cached = this.objectUrls.get(ref.path)
    if (cached) return cached
    const blob = await idbGet(ref.path).catch(() => undefined)
    if (!blob) throw new BackendError('not_found', 'File not found on this device')
    const url = URL.createObjectURL(blob)
    this.objectUrls.set(ref.path, url)
    return url
  }

  async deleteFile(ref: FileRef): Promise<void> {
    await idbDelete(ref.path).catch(() => undefined)
  }

  async invites(): Promise<Record<string, string>> {
    return { ...this.db.invites }
  }

  async resetInvite(memberId: string): Promise<string> {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    this.db.invites[memberId] = code
    this.write()
    return code
  }

  async createMember(input: { slug: string; name: string; role: 'coach' | 'athlete'; color: string }): Promise<string> {
    if (Object.values(this.db.members).some((m) => m.slug === input.slug)) throw new BackendError('conflict', 'That handle is taken')
    const id = uuid()
    const m: Member = {
      ...defaultMemberProfile(input.role, input.slug),
      id,
      slug: input.slug,
      name: input.name,
      role: input.role,
      color: input.color as MemberColor,
      // Shows as "invite pending" in the coach console, like a real new member (demo sign-in still works).
      joined: false,
      updatedAt: Date.now(),
    }
    this.db.members[id] = m
    this.db.invites[id] = Math.random().toString(36).slice(2, 8).toUpperCase()
    this.write()
    this.listeners.forEach((f) => f({ table: 'members', type: 'put', row: structuredClone(m) }))
    return id
  }
}
