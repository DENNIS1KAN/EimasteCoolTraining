import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Backend } from './backend/types'
import { BackendError } from './backend/types'
import type { Member, Snapshot, TableName, Tables, WorkoutLog } from './types'
import { TABLES } from './types'
import { __resetForTests, boot, flushNow, getState, put, refresh, signIn, signOut, update } from './store'

/* ------------------------------------------------------------------ a scriptable backend */

const ME = 'm1'
type Server = { [T in TableName]: Record<string, Tables[T]> }
const emptyServer = (): Server => ({ members: {}, programs: {}, logs: {}, weights: {}, mealPlans: {}, checkins: {}, cheers: {} })

const member = (patch: Partial<Member> = {}): Member => ({
  id: ME,
  slug: 'stelios',
  name: 'Stelios',
  role: 'athlete',
  color: 'blue',
  competes: true,
  goal: '',
  goalWeightKg: null,
  heightCm: null,
  programId: 'bts-12',
  programStart: null,
  coachNote: '',
  coachNoteAt: null,
  settings: { unit: 'kg', machines: {}, weightVisibility: 'change' },
  joined: true,
  updatedAt: 100,
  ...patch,
})

/** A workout log reduced to what these tests look at. */
const log = (ticks: boolean[], updatedAt = 0) =>
  ({ id: 'L', memberId: ME, week: 1, day: 0, ex: { '0': { sets: ticks.map((ok) => ({ w: '50', r: '10', ok })) } }, updatedAt }) as unknown as WorkoutLog
const ticks = (l: WorkoutLog | undefined) => (l as unknown as { ex: Record<string, { sets: { ok: boolean }[] }> } | undefined)?.ex['0'].sets.map((s) => s.ok)

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

class FakeBackend implements Backend {
  readonly kind = 'supabase' as const
  me: string | null = ME
  initError: BackendError | null = null
  loadError: BackendError | null = null
  putError: ((table: TableName, row: { id: string }) => BackendError | null) | null = null
  loadGate: Promise<void> | null = null
  putGate: Promise<void> | null = null
  puts: { table: TableName; row: unknown; changed?: string[] }[] = []
  subscribed = 0

  constructor(public server: Server) {}

  async init() {
    if (this.initError) throw this.initError
    return this.me
  }
  async loginProfiles() {
    return []
  }
  async signIn() {
    this.me = ME
    return ME
  }
  async join() {
    return ME
  }
  async signOut() {
    this.me = null
  }
  async changePassword() {}
  onSignedOut() {
    return () => {}
  }
  async loadAll(): Promise<Snapshot> {
    if (this.loadError) throw this.loadError
    // Read now, answer later: like a slow request on a weak signal.
    const snap = Object.fromEntries(TABLES.map((t) => [t, Object.values(structuredClone(this.server[t]))])) as unknown as Snapshot
    if (this.loadGate) await this.loadGate
    return snap
  }
  async put<T extends TableName>(table: T, row: Tables[T], changed?: string[]): Promise<Tables[T] | void> {
    this.puts.push({ table, row: structuredClone(row), changed })
    if (this.putGate) await this.putGate
    const err = this.putError?.(table, row)
    if (err) throw err
    if (table === 'members' && changed) {
      // patch_member: merge the changed fields into the stored profile
      const stored = { ...(this.server.members[row.id] as Member) }
      const into = stored as unknown as Record<string, unknown>
      const from = row as unknown as Record<string, Record<string, unknown>>
      for (const path of changed) {
        const [k, sub] = path.split('.')
        into[k] = sub ? { ...(into[k] as Record<string, unknown>), [sub]: from[k][sub] } : from[k]
      }
      const next = row as Member
      stored.updatedAt = Math.max(stored.updatedAt + 1, next.updatedAt)
      this.server.members[row.id] = stored
      return structuredClone(stored) as Tables[T]
    }
    ;(this.server[table] as Record<string, Tables[T]>)[row.id] = structuredClone(row)
  }
  async remove(table: TableName, id: string) {
    delete (this.server[table] as Record<string, unknown>)[id]
  }
  subscribe() {
    this.subscribed++
    return () => {}
  }
  async uploadFile(): Promise<never> {
    throw new Error('n/a')
  }
  async fileUrl(): Promise<never> {
    throw new Error('n/a')
  }
  async deleteFile() {}
  async invites() {
    return {}
  }
  async resetInvite(): Promise<never> {
    throw new Error('n/a')
  }
  async createMember(): Promise<never> {
    throw new Error('n/a')
  }
}

const offline = () => new BackendError('network', 'offline')
let server: Server

beforeEach(() => {
  localStorage.clear()
  __resetForTests()
  server = emptyServer()
  server.members[ME] = member()
})

afterEach(() => {
  vi.useRealTimers()
  __resetForTests()
})

async function start(b = new FakeBackend(server)) {
  await boot(b, 'test')
  expect(getState().status).toBe('ready')
  return b
}

/** The app is killed: only localStorage survives. */
function kill() {
  __resetForTests()
}

/* ------------------------------------------------------------------ tests */

describe('refresh while writing', () => {
  it('keeps a set that was saved while an older snapshot was loading, so the next edit keeps it too', async () => {
    const b = await start()
    put('logs', log([true, false]))
    await flushNow()

    const gate = deferred()
    b.loadGate = gate.promise
    const refreshing = refresh() // reads the server now (set 2 not ticked yet), answers later
    put('logs', { ...getState().logs.L, ...log([true, true]) })
    await flushNow()
    expect(ticks(server.logs.L)).toEqual([true, true])

    gate.resolve()
    await refreshing
    expect(ticks(getState().logs.L)).toEqual([true, true])

    // the next edit starts from the local copy: the server keeps set 2
    const cur = getState().logs.L as unknown as { ex: Record<string, { sets: { ok: boolean; r: string }[] }> }
    put('logs', { ...getState().logs.L, ex: { '0': { sets: cur.ex['0'].sets.map((s, i) => (i === 0 ? { ...s, r: '12' } : s)) } } } as never)
    await flushNow()
    expect(ticks(server.logs.L)).toEqual([true, true])
  })

  it('still follows the snapshot for rows nobody touched meanwhile (deleted elsewhere, changed elsewhere)', async () => {
    server.logs.L = log([true], 5)
    server.logs.X = { ...log([false], 5), id: 'X' }
    const b = await start()
    delete server.logs.X
    server.logs.L = log([true, true], 50)
    await refresh()
    expect(getState().logs.X).toBeUndefined()
    expect(ticks(getState().logs.L)).toEqual([true, true])
    expect(b.puts).toHaveLength(0)
  })
})

describe('offline writes', () => {
  it('survive the app being killed right after a tick, and reach the server on the next launch', async () => {
    const b = await start()
    put('logs', log([true, false]))
    await flushNow()
    window.dispatchEvent(new Event('pagehide')) // the cache is written (without the next tick)

    b.putError = offline
    put('logs', { ...getState().logs.L, ...log([true, true]) })
    await flushNow()
    expect(getState().sync.pending).toBe(1)
    kill()

    // relaunch still offline: the tick is on screen from the saved outbox
    const b2 = new FakeBackend(server)
    b2.initError = offline()
    await boot(b2, 'test')
    expect(getState().status).toBe('ready')
    expect(ticks(getState().logs.L)).toEqual([true, true])
    kill()

    // relaunch online: it is sent
    await start(new FakeBackend(server))
    await vi.waitFor(() => expect(ticks(server.logs.L)).toEqual([true, true]))
    expect(getState().sync.pending).toBe(0)
  })

  it('keeps writes (and the session) through network failures', async () => {
    const b = await start()
    b.putError = offline
    put('logs', log([true]))
    await flushNow()
    expect(getState().status).toBe('ready')
    expect(getState().sync).toMatchObject({ pending: 1, online: false })
  })

  it('retries writes the server failed on (5xx, rate limits) instead of dropping them', async () => {
    vi.useFakeTimers()
    const b = await start()
    let fails = 2
    b.putError = () => (fails-- > 0 ? new BackendError(fails ? 'unavailable' : 'rate_limited', 'busy') : null)
    put('logs', log([true]))
    await vi.advanceTimersByTimeAsync(300)
    expect(getState().sync).toMatchObject({ pending: 1, error: null })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(ticks(server.logs.L)).toEqual([true])
    expect(getState().sync.pending).toBe(0)
  })
})

describe('session loss', () => {
  it('keeps the queued workout when the session is gone, and sends it after signing in again', async () => {
    const b = await start()
    b.putError = () => new BackendError('auth', 'session ended')
    put('logs', log([true, true]))
    await flushNow()
    expect(getState().status).toBe('signed-out')
    expect(getState().logs).toEqual({})
    expect(localStorage.getItem('ect-outbox-v2:test:m1')).toContain('"L"')

    b.putError = null
    await signIn('stelios', 'secret1')
    expect(ticks(getState().logs.L)).toEqual([true, true])
    await vi.waitFor(() => expect(ticks(server.logs.L)).toEqual([true, true]))
  })

  it('keeps writes refused because the login was reset (no longer a member)', async () => {
    const b = await start()
    b.putError = () => new BackendError('forbidden', 'nope')
    b.me = null
    put('logs', log([true]))
    await flushNow()
    expect(getState().status).toBe('signed-out')
    expect(localStorage.getItem('ect-outbox-v2:test:m1')).toContain('"L"')
  })

  it('discards unsent writes on a deliberate sign-out', async () => {
    const b = await start()
    b.putError = offline
    put('logs', log([true]))
    await signOut()
    expect(getState().status).toBe('signed-out')
    expect(localStorage.getItem('ect-outbox-v2:test:m1')).toBeNull()
  })
})

describe('refusals', () => {
  it('drops only the refused version: an edit made while it was in flight is still sent', async () => {
    const b = await start()
    const gate = deferred()
    b.putGate = gate.promise
    b.putError = (_t, row) => (ticks(row as WorkoutLog)?.length === 1 ? new BackendError('unknown', 'bad row') : null)
    put('logs', log([true]))
    const flushing = flushNow()
    await vi.waitFor(() => expect(b.puts).toHaveLength(1))
    put('logs', log([true, true])) // typed while the first request was in flight
    b.putGate = null
    gate.resolve()
    await flushing
    expect(getState().sync.error).toBe('bad row')
    await vi.waitFor(() => expect(ticks(server.logs.L)).toEqual([true, true]))
    expect(ticks(getState().logs.L)).toEqual([true, true])
  })
})

describe('reconnecting', () => {
  it('subscribes to live updates even when the first resume after an offline start fails half-way', async () => {
    await start()
    window.dispatchEvent(new Event('pagehide'))
    kill()

    const b = new FakeBackend(server)
    b.initError = offline()
    await boot(b, 'test')
    expect(b.subscribed).toBe(0)

    b.initError = null
    b.loadError = offline()
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(getState().sync.online).toBe(false))
    expect(b.subscribed).toBe(0)

    b.loadError = null
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(b.subscribed).toBe(1))
  })

  it('clears the offline state by itself after a failed refresh (no online event on a weak signal)', async () => {
    vi.useFakeTimers()
    const b = await start()
    b.loadError = offline()
    await refresh()
    expect(getState().sync.online).toBe(false)
    b.loadError = null
    await vi.advanceTimersByTimeAsync(5_000)
    expect(getState().sync.online).toBe(true)
  })
})

describe('member profiles', () => {
  it('send only the changed fields and adopt the merged profile (edits from the coach are kept)', async () => {
    const b = await start()
    server.members[ME] = { ...server.members[ME], programStart: '2026-09-23', goal: 'Coach goal', updatedAt: 500 } // the coach, meanwhile
    update('members', ME, (m) => ({ ...m, settings: { ...m.settings, machines: { 'Leg Press': 'Hammer' } } }))
    update('members', ME, { heightCm: 181 })
    await flushNow()
    expect(b.puts.map((p) => p.changed)).toEqual([['settings.machines', 'heightCm']])
    expect(server.members[ME]).toMatchObject({ programStart: '2026-09-23', goal: 'Coach goal', heightCm: 181 })
    expect(getState().members[ME]).toMatchObject({ programStart: '2026-09-23', goal: 'Coach goal', heightCm: 181 })
    expect(getState().members[ME].settings.machines).toEqual({ 'Leg Press': 'Hammer' })
  })

  it('skip saves that change nothing', async () => {
    const b = await start()
    const before = getState().members[ME]
    expect(update('members', ME, { goal: '' })).toBe(before)
    await flushNow()
    expect(b.puts).toHaveLength(0)
    expect(getState().sync.pending).toBe(0)
  })
})
