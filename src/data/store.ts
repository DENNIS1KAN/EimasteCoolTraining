/**
 * App state + sync engine.
 *
 * - The whole squad's data is small (3-10 people), so it is loaded once into memory and kept live.
 * - Writes are optimistic: `put`/`remove` update state immediately, then go through an outbox that retries with
 *   backoff while offline. Each queued write carries its row, and the outbox is saved per member at once, so a
 *   workout logged offline survives the app being killed, the session expiring and signing in again.
 *   Pending local writes always win over remote echoes.
 * - Conflicts resolve last-writer-wins on `updatedAt`, also against a snapshot that was loading while rows changed.
 *   Member profiles are the exception: only the changed fields are sent and merged (see Backend.put).
 * - A write is only dropped when the server refuses it while we are still a signed-in member.
 * - In Supabase mode a copy of the data is cached in localStorage so the app opens instantly (and offline at the gym).
 */
import { useRef, useSyncExternalStore } from 'react'
import { BUILT_IN_PROGRAMS } from './programs'
import type { Backend, BackendErrorCode } from './backend/types'
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
  /** Why booting failed ('config': the deployment's config.js is wrong, not the connection). */
  bootErrorCode: BackendErrorCode | null
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
  bootErrorCode: null,
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
/** Pending writes are kept per member: after an involuntary sign-out they wait for that member's next sign-in. */
const outboxKey = (memberId: string) => `ect-outbox-v2:${cacheNs}:${memberId}`
const persists = () => !!backend && backend.kind !== 'demo'

let cacheTimer: ReturnType<typeof setTimeout> | null = null
function scheduleCacheWrite() {
  if (!persists() || state.status !== 'ready') return
  if (cacheTimer) return
  cacheTimer = setTimeout(writeCacheNow, 800)
}

/** Save the cache right away (the page is being hidden: iOS may freeze or kill it before a timer fires). */
function writeCacheNow() {
  if (cacheTimer) clearTimeout(cacheTimer)
  cacheTimer = null
  if (!persists() || state.status !== 'ready') return
  try {
    const tables: Partial<TableState> = {}
    for (const t of TABLES) (tables as Record<string, unknown>)[t] = state[t]
    localStorage.setItem(cacheKey(), JSON.stringify({ v: 1, meId: state.meId, tables }))
  } catch {
    /* quota / private mode: the cache is only a convenience */
  }
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
  if (cacheTimer) clearTimeout(cacheTimer)
  cacheTimer = null
  try {
    localStorage.removeItem(cacheKey())
    localStorage.removeItem(`ect-outbox-v1:${cacheNs}`) // format before v2 (row ids only)
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ outbox */

type AnyRow = Tables[TableName]
type Stamped = { id: string; updatedAt: number }

type Op =
  /** `changed`: fields to merge on the server (tables in MERGED_FIELDS), undefined = the whole row. */
  | { type: 'put'; table: TableName; id: string; seq: number; row: AnyRow; changed?: string[] }
  | { type: 'remove'; table: TableName; id: string; seq: number }

/**
 * Tables whose rows are edited from several phones at once and merged per field on the server. The value lists
 * object fields that are merged one level deeper (e.g. a member's settings: unit, machines, weightVisibility).
 */
const MERGED_FIELDS: Partial<Record<TableName, readonly string[]>> = { members: ['settings'] }

const outbox = new Map<string, Op>()
/** Whose writes the outbox holds (null while signed out). */
let outboxOwner: string | null = null
let seq = 0
const opKey = (table: TableName, id: string) => `${table}:${id}`

function persistOutbox() {
  if (!persists() || !outboxOwner) return
  try {
    if (outbox.size) localStorage.setItem(outboxKey(outboxOwner), JSON.stringify([...outbox.values()]))
    else localStorage.removeItem(outboxKey(outboxOwner))
  } catch {
    /* ignore */
  }
}

/** Switch the outbox to a member's pending writes (saved on this device from an earlier session, if any). */
function useOutboxOf(memberId: string) {
  if (outboxOwner === memberId) return
  if (outboxOwner) persistOutbox()
  outbox.clear()
  outboxOwner = memberId
  if (!persists()) return
  try {
    const raw = localStorage.getItem(outboxKey(memberId))
    const ops: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(ops)) return
    for (const op of ops as Op[]) {
      if (!op || !TABLES.includes(op.table) || typeof op.id !== 'string') continue
      if (op.type === 'put' && op.row && typeof op.row === 'object') outbox.set(opKey(op.table, op.id), { ...op, seq: ++seq })
      else if (op.type === 'remove') outbox.set(opKey(op.table, op.id), { ...op, seq: ++seq })
    }
  } catch {
    /* ignore */
  }
}

/** Lay the pending writes over a set of tables (a snapshot or the cache): they are newer than anything stored. */
function applyOutbox(tables: TableState) {
  for (const op of outbox.values()) {
    const target = tables[op.table] as Record<string, AnyRow>
    if (op.type === 'remove') delete target[op.id]
    else target[op.id] = op.row
  }
}

let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let flushAgain = false
/** Consecutive failed flushes, for the retry backoff. */
let flushFailures = 0

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

const errorCode = (e: unknown) => (e instanceof BackendError ? e.code : 'unknown')

/**
 * The server refused a write. That is only final while we are still a signed-in member: a login the coach reset,
 * or a session that ended, must not cost the member their queued workout.
 */
async function stillMember(): Promise<'yes' | 'no' | 'unknown'> {
  try {
    const id = await getBackend().init()
    return id && id === state.meId ? 'yes' : 'no'
  } catch {
    return 'unknown'
  }
}

async function flush(): Promise<void> {
  if (!backend || state.status !== 'ready') return
  if (flushing) {
    flushAgain = true
    return
  }
  flushing = true
  let retryIn = 0
  const b = backend
  try {
    for (const key of [...outbox.keys()]) {
      // Always send the newest version: the op may have been replaced while an earlier one was in flight.
      const op = outbox.get(key)
      if (!op || state.status !== 'ready') continue
      try {
        let saved: AnyRow | void = undefined
        if (op.type === 'put') saved = await b.put(op.table, op.row as never, op.changed)
        else await b.remove(op.table, op.id)
        if (outbox.get(key)?.seq === op.seq) {
          outbox.delete(key)
          if (saved) adoptSaved(op.table, saved)
        }
        flushFailures = 0
        setSync({ online: true, lastSyncAt: Date.now(), error: null })
        if (pendingResume) void resumeSession()
      } catch (e) {
        const code = errorCode(e)
        if (isRetryable(e)) {
          retryIn = Math.min(30000, 1500 * 2 ** Math.min(++flushFailures, 5))
          if (code === 'network') setSync({ online: false })
          break
        }
        // The session is gone for good: keep every queued write for this member's next sign-in.
        if (code === 'auth') {
          await endSession(false)
          return
        }
        const member = await stillMember()
        if (member === 'no') {
          await endSession(false)
          return
        }
        if (member === 'unknown') {
          retryIn = Math.min(30000, 1500 * 2 ** Math.min(++flushFailures, 5))
          break
        }
        // A real refusal (e.g. not allowed): drop this version and reconcile with the server's truth.
        // An edit made while it was in flight stays queued and is tried on its own.
        if (outbox.get(key)?.seq === op.seq) outbox.delete(key)
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

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b || Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

/** Fields that differ between two versions of a row: "goal", or "settings.unit" inside a merged object field. */
function changedFields(prev: object, next: object, nested: readonly string[]): string[] {
  const a = prev as Record<string, unknown>
  const b = next as Record<string, unknown>
  const out: string[] = []
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === 'updatedAt') continue
    const x = a[k]
    const y = b[k]
    if (nested.includes(k) && isPlainObject(x) && isPlainObject(y)) {
      for (const sub of new Set([...Object.keys(x), ...Object.keys(y)])) if (!deepEqual(x[sub], y[sub])) out.push(`${k}.${sub}`)
    } else if (!deepEqual(x, y)) out.push(k)
  }
  return out
}

/**
 * Rows touched locally or by a live event, with a counter value: a snapshot that started loading before a touch
 * must not overwrite that row with its older copy (see mergeSnapshot).
 */
const touched = new Map<string, { table: TableName; id: string; n: number }>()
let touchCount = 0
let loadsInFlight = 0
function touch(table: TableName, id: string) {
  touched.set(opKey(table, id), { table, id, n: ++touchCount })
}
function beginLoad(): number {
  loadsInFlight++
  return touchCount
}
function endLoad() {
  if (--loadsInFlight <= 0) {
    loadsInFlight = 0
    touched.clear()
  }
}

/**
 * Insert or replace a row (optimistic). `updatedAt` is stamped automatically and is monotonic per row.
 * `debounceMs` lets fast typing coalesce into one network write.
 */
export function put<T extends TableName>(table: T, row: Row<T>, opts: { debounceMs?: number } = {}): Row<T> {
  const key = opKey(table, row.id)
  const prev = (state[table] as Record<string, Row<T>>)[row.id]
  const pending = outbox.get(key)
  const nested = MERGED_FIELDS[table]
  let changed: string[] | undefined
  if (nested && prev) {
    const diff = changedFields(prev, row, nested)
    if (!diff.length && !pending) return prev // nothing to save
    // Accumulate while queued: the server must receive every field changed since its copy was current.
    changed = !pending ? diff : pending.type === 'put' && pending.changed ? [...new Set([...pending.changed, ...diff])] : undefined
  }
  const stamped = { ...row, updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1) } as Row<T>
  setState((s) => ({ [table]: { ...s[table], [row.id]: stamped } }) as Partial<State>)
  touch(table, row.id)
  outbox.set(key, { type: 'put', table, id: row.id, seq: ++seq, row: stamped, changed })
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
  touch(table, id)
  outbox.set(opKey(table, id), { type: 'remove', table, id, seq: ++seq })
  persistOutbox()
  setSync({ pending: outbox.size })
  scheduleFlush(200)
}

/** Force pending writes out now (e.g. when finishing a workout). */
export const flushNow = (): Promise<void> => flush()

/* ------------------------------------------------------------------ remote merge */

/** The server's version of a row we just wrote (e.g. a profile merged with another phone's edits). */
function adoptSaved(table: TableName, saved: AnyRow) {
  const cur = (state[table] as Record<string, Stamped>)[saved.id]
  if (cur && (cur.updatedAt > saved.updatedAt || deepEqual(cur, saved))) return
  setState((s) => ({ [table]: { ...s[table], [saved.id]: saved } }) as Partial<State>)
  touch(table, saved.id)
}

function applyRemote(e: ChangeEvent) {
  if (state.status !== 'ready') return
  const id = e.type === 'put' ? e.row.id : e.id
  if (outbox.has(opKey(e.table, id))) return // our pending write wins
  if (e.type === 'put') {
    const cur = (state[e.table] as Record<string, Stamped>)[id]
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
  touch(e.table, id)
}

/**
 * Replace the tables with a snapshot that started loading when the touch counter was at `mark`.
 * Rows changed since then (a set ticked and already saved, a live event) keep their newer version, and pending
 * writes are laid on top. Anything else follows the snapshot, including rows deleted elsewhere.
 */
function mergeSnapshot(snap: Snapshot, mark: number) {
  const next = emptyTables()
  const snapByTable: { [T in TableName]: Tables[T][] } = snap
  for (const t of TABLES) {
    const target = next[t] as Record<string, Stamped>
    for (const row of snapByTable[t] as Stamped[]) target[row.id] = row
  }
  for (const { table, id, n } of touched.values()) {
    if (n <= mark) continue
    const cur = (state[table] as Record<string, Stamped>)[id]
    const target = next[table] as Record<string, Stamped>
    if (!cur) delete target[id]
    else if (!target[id] || cur.updatedAt >= target[id].updatedAt) target[id] = cur
  }
  applyOutbox(next)
  setState({ ...next })
}

let lastRefresh = 0
let refreshCount = 0
let appliedRefresh = 0
/** Re-read everything from the backend and merge (cheap: the dataset is small). */
export async function refresh(): Promise<void> {
  if (!backend || state.status !== 'ready' || pendingResume) return
  lastRefresh = Date.now()
  const n = ++refreshCount
  const mark = beginLoad()
  try {
    const snap = await backend.loadAll()
    // Signed out meanwhile, or a later refresh already applied a newer snapshot.
    if (state.status !== 'ready' || n < appliedRefresh) return
    appliedRefresh = n
    mergeSnapshot(snap, mark)
    stopReconnect()
    setSync({ online: true, lastSyncAt: Date.now() })
    // Removed from the squad, or the coach reset this login.
    if (state.meId && !state.members[state.meId]) await endSession(false, true)
  } catch (e) {
    const code = errorCode(e)
    if (code === 'auth') await endSession(false)
    else if (isRetryable(e)) {
      if (code === 'network') setSync({ online: false })
      scheduleReconnect()
    }
  } finally {
    endLoad()
  }
}

/* ------------------------------------------------------------------ session lifecycle */

let unsubs: (() => void)[] = []
let windowHooked = false

/** Retries refresh (or the offline start's resume) with backoff: a weak signal does not fire an 'online' event. */
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectDelay = 0
function scheduleReconnect() {
  if (reconnectTimer || !backend || backend.kind === 'demo') return
  reconnectDelay = Math.min(60000, reconnectDelay ? reconnectDelay * 2 : 5000)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void (pendingResume ? resumeSession() : refresh())
  }, reconnectDelay)
}
function stopReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  reconnectDelay = 0
}

function hookWindow() {
  if (windowHooked || typeof window === 'undefined') return
  windowHooked = true
  window.addEventListener('online', () => {
    setSync({ online: true })
    stopReconnect()
    if (pendingResume) {
      void resumeSession()
      return
    }
    void flush()
    void refresh()
  })
  window.addEventListener('offline', () => setSync({ online: false }))
  // Last chance before iOS freezes or evicts the page.
  window.addEventListener('pagehide', () => {
    writeCacheNow()
    persistOutbox()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      writeCacheNow()
      void flush()
      return
    }
    if (pendingResume) void resumeSession()
    else {
      if (outbox.size) void flush()
      if (Date.now() - lastRefresh > 20000) void refresh()
    }
  })
}

/** True after an offline start from the cache: the backend session still has to be (re)connected. */
let pendingResume = false
let resuming: Promise<void> | null = null

/** Finish an offline start once the network is back: restore the session, subscribe, merge, flush. */
function resumeSession(): Promise<void> {
  if (!backend || !pendingResume) return Promise.resolve()
  const b = backend
  resuming ??= (async () => {
    try {
      const meId = await b.init()
      if (!meId) await endSession(false)
      else await startSession(meId) // clears pendingResume once connected
    } catch (e) {
      if (!pendingResume) return
      if (isRetryable(e)) {
        if (errorCode(e) === 'network') setSync({ online: false })
        scheduleReconnect()
      } else await endSession(false)
    } finally {
      resuming = null
    }
  })()
  return resuming
}

async function startSession(meId: string) {
  const b = getBackend()
  useOutboxOf(meId)
  const mark = beginLoad()
  try {
    const snap = await b.loadAll()
    setState({ status: 'ready', meId, bootError: null, bootErrorCode: null })
    mergeSnapshot(snap, mark)
  } finally {
    endLoad()
  }
  if (!state.members[meId]) {
    await endSession(false, true)
    throw new BackendError('not_found', 'Your profile no longer exists.')
  }
  unsubs.forEach((u) => u())
  unsubs = [b.subscribe(applyRemote), b.onSignedOut(() => void endSession(false))]
  pendingResume = false
  stopReconnect()
  lastRefresh = Date.now()
  setSync({ online: true, lastSyncAt: Date.now(), pending: outbox.size })
  if (outbox.size) scheduleFlush(0)
}

/**
 * Leave the signed-in state. `explicit` (the member chose to sign out) also discards their unsent writes;
 * otherwise (session expired, login reset) they stay saved on this device and are sent after the next sign-in.
 * `dropLogin` also ends the backend session (it no longer belongs to a squad member).
 */
async function endSession(explicit: boolean, dropLogin = false) {
  unsubs.forEach((u) => u())
  unsubs = []
  pendingResume = false
  stopReconnect()
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  flushFailures = 0
  if (explicit) outbox.clear()
  persistOutbox()
  outbox.clear()
  outboxOwner = null
  touched.clear()
  clearCache()
  if (state.status !== 'signed-out') {
    setState((s) => ({ status: 'signed-out', meId: null, sync: { ...s.sync, pending: 0, error: null }, ...emptyTables() }))
  }
  if (dropLogin && backend) {
    try {
      await backend.signOut()
    } catch {
      /* the login is useless anyway */
    }
  }
}

/** Start the app with a backend. `namespace` separates caches of different projects/modes. */
export async function boot(b: Backend, namespace: string): Promise<void> {
  backend = b
  cacheNs = namespace
  setState({ backend: b.kind, status: 'booting', bootError: null, bootErrorCode: null })
  hookWindow()
  const cached = b.kind === 'demo' ? null : readCache()
  if (cached?.meId) {
    // Open instantly from the cache, with this member's unsent writes on top (the cache may predate them).
    useOutboxOf(cached.meId)
    applyOutbox(cached.tables)
    setState((s) => ({ status: 'ready', meId: cached.meId, ...cached.tables, sync: { ...s.sync, pending: outbox.size } }))
  }
  try {
    const meId = await b.init()
    if (!meId) {
      await endSession(false)
      return
    }
    await startSession(meId)
  } catch (e) {
    if (cached?.meId && state.status === 'ready' && isRetryable(e)) {
      // Offline at the gym: keep working from the cache; connect when the network returns.
      pendingResume = true
      setSync({ online: errorCode(e) !== 'network' && state.sync.online, pending: outbox.size })
      scheduleReconnect()
      return
    }
    setState({ status: 'error', bootError: e instanceof Error ? e.message : String(e), bootErrorCode: errorCode(e) })
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

/** Sign out on purpose. Writes that could not be sent are discarded (the account sheet warns about them first). */
export async function signOut(): Promise<void> {
  try {
    await flush()
    await getBackend().signOut()
  } finally {
    await endSession(true)
  }
}

/** Test helper: reset module state. */
export function __resetForTests(): void {
  unsubs.forEach((u) => u())
  unsubs = []
  outbox.clear()
  outboxOwner = null
  touched.clear()
  loadsInFlight = 0
  pendingResume = false
  resuming = null
  flushing = false
  flushAgain = false
  flushFailures = 0
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  if (cacheTimer) clearTimeout(cacheTimer)
  cacheTimer = null
  stopReconnect()
  backend = null
  state = { ...state, status: 'booting', meId: null, bootError: null, bootErrorCode: null, ...emptyTables() }
}
