/**
 * App state + sync engine.
 *
 * - The whole squad's data is small (3-10 people), so it is loaded once into memory and kept live.
 * - Writes are optimistic: `put`/`remove` update state immediately, then go through a persisted outbox
 *   that retries with backoff while offline. Pending local writes always win over remote echoes.
 * - Conflicts resolve last-writer-wins on `updatedAt`.
 * - In Supabase mode a copy of the data is cached in localStorage so the app opens instantly (and offline at the gym).
 */
import { useRef, useSyncExternalStore } from 'react'
import { BUILT_IN_PROGRAMS } from './programs'
import type { Backend } from './backend/types'
import { BackendError, isRetryable } from './backend/types'
import type { ChangeEvent, Member, Snapshot, TableName, Tables } from './types'
import { TABLES } from './types'

export type TableState = { [T in TableName]: Record<string, Tables[T]> }

export interface SyncState {
  /** Writes waiting to reach the server. */
  pending: number
  online: boolean
  /** Last non-retryable error (e.g. permission denied), cleared on the next successful write. */
  error: string | null
  lastSyncAt: number | null
}

export interface State extends TableState {
  status: 'booting' | 'signed-out' | 'ready' | 'error'
  backend: 'demo' | 'supabase'
  meId: string | null
  sync: SyncState
  bootError: string | null
}

const emptyTables = (): TableState => ({
  members: {},
  programs: Object.fromEntries(BUILT_IN_PROGRAMS.map((p) => [p.id, p])),
  logs: {},
  weights: {},
  mealPlans: {},
  checkins: {},
  cheers: {},
})

let state: State = {
  status: 'booting',
  backend: 'demo',
  meId: null,
  sync: { pending: 0, online: typeof navigator === 'undefined' ? true : navigator.onLine !== false, error: null, lastSyncAt: null },
  bootError: null,
  ...emptyTables(),
}

const listeners = new Set<() => void>()
export const getState = (): State => state
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)): void {
  const p = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...p }
  listeners.forEach((f) => f())
  scheduleCacheWrite()
}
export function subscribe(f: () => void): () => void {
  listeners.add(f)
  return () => listeners.delete(f)
}

/* ------------------------------------------------------------------ hooks */

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  for (const k of ka) if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false
  return true
}

/**
 * Subscribe to a slice of state. Derived arrays/objects are fine: results are compared shallowly,
 * so a selector like `s => Object.values(s.members)` only re-renders when a member changes.
 */
export function useStore<T>(selector: (s: State) => T): T {
  const cache = useRef<{ s: State; f: (s: State) => T; v: T } | null>(null)
  const sel = useRef(selector)
  sel.current = selector
  const get = () => {
    const c = cache.current
    const f = sel.current
    // Re-run when the state OR the selector changed (selectors may close over props).
    if (c && c.s === state && c.f === f) return c.v
    const v = f(state)
    if (c && shallowEqual(c.v, v)) {
      cache.current = { s: state, f, v: c.v }
      return c.v
    }
    cache.current = { s: state, f, v }
    return v
  }
  return useSyncExternalStore(subscribe, get, get)
}

export const useMe = (): Member | null => useStore((s) => (s.meId ? (s.members[s.meId] ?? null) : null))
export const useStatus = () => useStore((s) => s.status)
export const useSync = () => useStore((s) => s.sync)

/* ------------------------------------------------------------------ backend + cache */

let backend: Backend | null = null
let cacheNs = 'demo'
export function getBackend(): Backend {
  if (!backend) throw new Error('Backend not initialised')
  return backend
}

const cacheKey = () => `ect-cache-v1:${cacheNs}`
const outboxKey = () => `ect-outbox-v1:${cacheNs}`

let cacheTimer: ReturnType<typeof setTimeout> | null = null
function scheduleCacheWrite() {
  if (!backend || backend.kind === 'demo' || state.status !== 'ready') return
  if (cacheTimer) return
  cacheTimer = setTimeout(() => {
    cacheTimer = null
    try {
      const tables: Partial<TableState> = {}
      for (const t of TABLES) (tables as Record<string, unknown>)[t] = state[t]
      localStorage.setItem(cacheKey(), JSON.stringify({ v: 1, meId: state.meId, tables }))
    } catch {
      /* quota / private mode: the cache is only a convenience */
    }
  }, 800)
}

function readCache(): { meId: string | null; tables: TableState } | null {
  try {
    const raw = localStorage.getItem(cacheKey())
    if (!raw) return null
    const c = JSON.parse(raw)
    if (!c || c.v !== 1 || !c.tables) return null
    const tables = emptyTables()
    for (const t of TABLES) Object.assign(tables[t], c.tables[t] || {})
    return { meId: c.meId ?? null, tables }
  } catch {
    return null
  }
}

function clearCache() {
  try {
    localStorage.removeItem(cacheKey())
    localStorage.removeItem(outboxKey())
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ outbox */

type Op =
  | { type: 'put'; table: TableName; id: string; seq: number; attempts: number }
  | { type: 'remove'; table: TableName; id: string; seq: number; attempts: number }

const outbox = new Map<string, Op>()
let seq = 0
const opKey = (table: TableName, id: string) => `${table}:${id}`

function persistOutbox() {
  if (!backend || backend.kind === 'demo') return
  try {
    localStorage.setItem(outboxKey(), JSON.stringify([...outbox.values()]))
  } catch {
    /* ignore */
  }
}
function loadOutbox() {
  outbox.clear()
  try {
    const raw = localStorage.getItem(outboxKey())
    const ops: Op[] = raw ? JSON.parse(raw) : []
    for (const op of ops) outbox.set(opKey(op.table, op.id), { ...op, seq: ++seq, attempts: 0 })
  } catch {
    /* ignore */
  }
}

let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let flushAgain = false

function scheduleFlush(delay = 700) {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush()
  }, delay)
}

function setSync(p: Partial<SyncState>) {
  setState((s) => ({ sync: { ...s.sync, ...p } }))
}

async function flush(): Promise<void> {
  if (!backend || state.status !== 'ready') return
  if (flushing) {
    flushAgain = true
    return
  }
  flushing = true
  let retryIn = 0
  try {
    for (const [key, op] of [...outbox]) {
      try {
        if (op.type === 'put') {
          const row = (state[op.table] as Record<string, Tables[TableName]>)[op.id]
          if (row) await backend.put(op.table, row as never)
        } else {
          await backend.remove(op.table, op.id)
        }
        if (outbox.get(key)?.seq === op.seq) outbox.delete(key)
        setSync({ online: true, lastSyncAt: Date.now(), error: null })
      } catch (e) {
        if (isRetryable(e)) {
          op.attempts++
          retryIn = Math.min(30000, 1500 * 2 ** Math.min(op.attempts, 5))
          if (e instanceof BackendError && e.code === 'network') setSync({ online: false })
          break
        }
        // Permanent failure (e.g. not allowed): drop it and reconcile with the server's truth.
        outbox.delete(key)
        setSync({ error: e instanceof Error ? e.message : String(e) })
        void refresh()
      }
    }
  } finally {
    flushing = false
    persistOutbox()
    setSync({ pending: outbox.size })
    if (flushAgain) {
      flushAgain = false
      scheduleFlush(0)
    } else if (retryIn && outbox.size) scheduleFlush(retryIn)
  }
}

/* ------------------------------------------------------------------ mutations */

type Row<T extends TableName> = Tables[T]

/**
 * Insert or replace a row (optimistic). `updatedAt` is stamped automatically and is monotonic per row.
 * `debounceMs` lets fast typing coalesce into one network write.
 */
export function put<T extends TableName>(table: T, row: Row<T>, opts: { debounceMs?: number } = {}): Row<T> {
  const prev = (state[table] as Record<string, Row<T>>)[row.id]
  const stamped = { ...row, updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1) } as Row<T>
  setState((s) => ({ [table]: { ...s[table], [row.id]: stamped } }) as Partial<State>)
  outbox.set(opKey(table, row.id), { type: 'put', table, id: row.id, seq: ++seq, attempts: 0 })
  persistOutbox()
  setSync({ pending: outbox.size })
  scheduleFlush(opts.debounceMs ?? 300)
  return stamped
}

/** Patch a row by id (no-op if missing). */
export function update<T extends TableName>(
  table: T,
  id: string,
  patch: Partial<Row<T>> | ((row: Row<T>) => Row<T>),
  opts: { debounceMs?: number } = {},
): Row<T> | null {
  const cur = (state[table] as Record<string, Row<T>>)[id]
  if (!cur) return null
  const next = typeof patch === 'function' ? patch(cur) : ({ ...cur, ...patch } as Row<T>)
  return put(table, next, opts)
}

export function remove(table: TableName, id: string): void {
  setState((s) => {
    const copy = { ...s[table] } as Record<string, unknown>
    delete copy[id]
    return { [table]: copy } as Partial<State>
  })
  outbox.set(opKey(table, id), { type: 'remove', table, id, seq: ++seq, attempts: 0 })
  persistOutbox()
  setSync({ pending: outbox.size })
  scheduleFlush(200)
}

/** Force pending writes out now (e.g. when finishing a workout). */
export const flushNow = (): Promise<void> => flush()

/* ------------------------------------------------------------------ remote merge */

function applyRemote(e: ChangeEvent) {
  if (state.status !== 'ready') return
  const id = e.type === 'put' ? e.row.id : e.id
  if (outbox.has(opKey(e.table, id))) return // our pending write wins
  if (e.type === 'put') {
    const cur = (state[e.table] as Record<string, { updatedAt: number }>)[id]
    if (cur && cur.updatedAt > e.row.updatedAt) return
    setState((s) => ({ [e.table]: { ...s[e.table], [id]: e.row } }) as Partial<State>)
  } else {
    if (!(state[e.table] as Record<string, unknown>)[id]) return
    setState((s) => {
      const copy = { ...s[e.table] } as Record<string, unknown>
      delete copy[id]
      return { [e.table]: copy } as Partial<State>
    })
  }
}

function mergeSnapshot(snap: Snapshot) {
  const next = emptyTables()
  const snapByTable: { [T in TableName]: Tables[T][] } = snap
  for (const t of TABLES) {
    const target = next[t] as Record<string, { id: string; updatedAt: number }>
    for (const row of snapByTable[t] as { id: string; updatedAt: number }[]) target[row.id] = row
    // keep pending local writes (and their deletions)
    for (const op of outbox.values()) {
      if (op.table !== t) continue
      if (op.type === 'remove') delete target[op.id]
      else {
        const local = (state[t] as Record<string, { id: string; updatedAt: number }>)[op.id]
        if (local) target[op.id] = local
      }
    }
  }
  setState({ ...next })
}

let lastRefresh = 0
/** Re-read everything from the backend and merge (cheap: the dataset is small). */
export async function refresh(): Promise<void> {
  if (!backend || state.status !== 'ready') return
  lastRefresh = Date.now()
  try {
    const snap = await backend.loadAll()
    mergeSnapshot(snap)
    setSync({ online: true, lastSyncAt: Date.now() })
    if (state.meId && !state.members[state.meId]) await signOut()
  } catch (e) {
    if (e instanceof BackendError && e.code === 'auth') await handleSignedOut()
    else if (isRetryable(e)) setSync({ online: false })
  }
}

/* ------------------------------------------------------------------ session lifecycle */

let unsubs: (() => void)[] = []
let windowHooked = false

function hookWindow() {
  if (windowHooked || typeof window === 'undefined') return
  windowHooked = true
  window.addEventListener('online', () => {
    setSync({ online: true })
    if (pendingResume) {
      void resumeSession()
      return
    }
    void flush()
    void refresh()
  })
  window.addEventListener('offline', () => setSync({ online: false }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && pendingResume) void resumeSession()
    else if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 20000) void refresh()
    if (document.visibilityState === 'hidden') void flush()
  })
}

/** True after an offline start from the cache: the backend session still has to be (re)connected. */
let pendingResume = false

/** Finish an offline start once the network is back: restore the session, subscribe, merge, flush. */
async function resumeSession() {
  if (!backend || !pendingResume) return
  try {
    const meId = await backend.init()
    pendingResume = false
    if (!meId) await handleSignedOut()
    else await startSession(meId)
  } catch (e) {
    if (!isRetryable(e)) {
      pendingResume = false
      await handleSignedOut()
    }
  }
}

async function startSession(meId: string) {
  const b = getBackend()
  const snap = await b.loadAll()
  setState({ status: 'ready', meId, bootError: null })
  mergeSnapshot(snap)
  if (!state.members[meId]) throw new BackendError('not_found', 'Your profile no longer exists.')
  unsubs.forEach((u) => u())
  unsubs = [b.subscribe(applyRemote), b.onSignedOut(() => void handleSignedOut())]
  lastRefresh = Date.now()
  setSync({ online: true, lastSyncAt: Date.now() })
  if (outbox.size) scheduleFlush(0)
}

async function handleSignedOut() {
  unsubs.forEach((u) => u())
  unsubs = []
  outbox.clear()
  clearCache()
  setState({ status: 'signed-out', meId: null, ...emptyTables() })
}

/** Start the app with a backend. `namespace` separates caches of different projects/modes. */
export async function boot(b: Backend, namespace: string): Promise<void> {
  backend = b
  cacheNs = namespace
  setState({ backend: b.kind, status: 'booting', bootError: null })
  hookWindow()
  loadOutbox()
  const cached = b.kind === 'demo' ? null : readCache()
  if (cached?.meId) setState({ status: 'ready', meId: cached.meId, ...cached.tables })
  try {
    const meId = await b.init()
    if (!meId) {
      await handleSignedOut()
      return
    }
    await startSession(meId)
  } catch (e) {
    if (cached?.meId && isRetryable(e)) {
      // Offline at the gym: keep working from the cache; connect when the network returns.
      pendingResume = true
      setSync({ online: false, pending: outbox.size })
      return
    }
    setState({ status: 'error', bootError: e instanceof Error ? e.message : String(e) })
  }
}

export async function signIn(slug: string, password: string): Promise<void> {
  const meId = await getBackend().signIn(slug, password)
  await startSession(meId)
}

export async function join(slug: string, code: string, password: string): Promise<void> {
  const meId = await getBackend().join(slug, code, password)
  await startSession(meId)
}

export async function signOut(): Promise<void> {
  try {
    await flush()
    await getBackend().signOut()
  } finally {
    await handleSignedOut()
  }
}

/** Test helper: reset module state. */
export function __resetForTests(): void {
  unsubs.forEach((u) => u())
  unsubs = []
  outbox.clear()
  backend = null
  state = { ...state, status: 'booting', meId: null, bootError: null, ...emptyTables() }
}
