/**
 * Shared backend: Supabase Postgres (row-level security, see supabase/schema.sql) + Auth + Storage + Realtime.
 * Row and error mapping lives in ./supabase-map. Every method throws BackendError only, so the store can
 * tell a lost connection (retry later) from a refusal (drop the write and reload).
 */
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppConfig } from '../../config'
import { uuid } from '../../lib/ids'
import type { ChangeEvent, Cheer, FileRef, LoginProfile, Member, Program, Snapshot, TableName, Tables } from '../types'
import { TABLES } from '../types'
import type { Backend } from './types'
import { BackendError, isRetryable } from './types'
import type { DbRow, LoginProfileRow, RealtimePayload } from './supabase-map'
import {
  SQL_TABLE,
  changeFromPayload,
  contentTypeFor,
  fromRow,
  isUserAlreadyExists,
  joinEmail,
  loginProfileFromRpc,
  memberDataPatch,
  memberFromRow,
  memberPatch,
  safeFileName,
  tableFromSql,
  toBackendError,
  toRow,
} from './supabase-map'

const AUTH_STORAGE_KEY = 'ect-auth'
const BUCKET = 'meal-plans'
export const CHAT_BUCKET = 'squad-photos'
const bucketOf = (ref: FileRef): string => ref.bucket ?? BUCKET
/** PostgREST returns at most this many rows per request (Supabase's default max-rows). */
export const PAGE_SIZE = 1000
const MAX_FILE = 15 * 1024 * 1024
const SIGNED_URL_TTL_S = 3600
const REQUEST_TIMEOUT_MS = 30_000
const UPLOAD_TIMEOUT_MS = 180_000

type Result<T> = { data: T | null; error: unknown; status?: number }

/** Await a Supabase call and unwrap it; failures of any kind become BackendError. */
async function run<T>(query: PromiseLike<Result<T>>): Promise<T> {
  let res: Result<T>
  try {
    res = await query
  } catch (e) {
    throw toBackendError(e)
  }
  if (res.error) throw toBackendError(res.error, res.status)
  return res.data as T
}

/** Like run(), for auth calls whose error we want to inspect before mapping. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    throw toBackendError(e)
  }
}

const sessionEnded = () => new BackendError('auth', 'Your session has ended. Sign in again.')

const urlOf = (input: RequestInfo | URL): string => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)

/**
 * Data requests must never go out with the anon key. supabase-js falls back to it whenever it has no usable user
 * token, e.g. for a minute after a token refresh failed offline: the server would then answer "permission denied"
 * and a perfectly good workout would be treated as refused. Such a request fails here as a lost connection
 * instead, so the outbox keeps it and retries once the session is back. Only login_profiles() is public.
 */
export function guardAnonymous(anonKey: string, next: typeof fetch): typeof fetch {
  return (input, init = {}) => {
    const url = urlOf(input)
    const isData = /\/(rest|storage)\/v1\//.test(url) && !/\/rest\/v1\/rpc\/login_profiles\b/.test(url)
    if (isData) {
      const auth = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined)).get('Authorization')
      if (!auth || auth === `Bearer ${anonKey}`) {
        return Promise.reject(new DOMException('Failed to fetch: not signed in yet', 'AbortError'))
      }
    }
    return next(input, init)
  }
}

/** fetch with a deadline: a stalled request on a weak gym signal must fail (and be retried) instead of blocking sync. */
export function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = urlOf(input)
  const upload = url.includes('/storage/v1/object/') && (init.method ?? 'GET').toUpperCase() !== 'GET'
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), upload ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS)
  const outer = init.signal
  if (outer) {
    if (outer.aborted) ctrl.abort()
    else outer.addEventListener('abort', () => ctrl.abort(), { once: true })
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

export class SupabaseBackend implements Backend {
  readonly kind = 'supabase' as const
  private readonly sb: SupabaseClient
  private readonly domain: string
  private readonly signedUrls = new Map<string, { url: string; expires: number }>()

  constructor(config: AppConfig) {
    this.domain = config.authEmailDomain
    this.sb = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: AUTH_STORAGE_KEY,
        // Hash routing (#/join/...) must never be mistaken for an OAuth callback.
        detectSessionInUrl: false,
      },
      global: { fetch: guardAnonymous(config.supabaseAnonKey, fetchWithTimeout) },
    })
  }

  /**
   * Resolves when there is a signed-in session to send data requests with. Throws 'network' (retry later) while it
   * cannot be renewed, e.g. offline with an expired access token, and 'auth' when it is gone for good.
   */
  private async requireSession(): Promise<void> {
    const { data, error } = await call(() => this.sb.auth.getSession())
    if (error) {
      const e = toBackendError(error)
      throw isRetryable(e) ? e : sessionEnded()
    }
    if (!data.session) throw sessionEnded()
  }

  /** The server refused our token (expired early, clock skew): get a fresh one. Same errors as requireSession. */
  private async renewSession(): Promise<void> {
    const { data, error } = await call(() => this.sb.auth.refreshSession())
    if (error) {
      const e = toBackendError(error)
      throw isRetryable(e) ? e : sessionEnded()
    }
    if (!data.session) throw sessionEnded()
  }

  /** A data request as the signed-in user; when the server refuses the token, renew it once and try again. */
  private async data<T>(query: () => PromiseLike<Result<T>>): Promise<T> {
    await this.requireSession()
    try {
      return await run(query())
    } catch (e) {
      if (!(e instanceof BackendError) || e.code !== 'auth') throw e
    }
    await this.renewSession()
    return run(query())
  }

  /* ---------------------------------------------------------------- session */

  async init(): Promise<string | null> {
    const { data, error } = await call(() => this.sb.auth.getSession())
    if (error) {
      const e = toBackendError(error)
      if (e.code === 'network') throw e
      await this.dropSession() // e.g. refresh token revoked: show the login screen
      return null
    }
    const user = data.session?.user
    if (!user) return null
    try {
      const rows = await run<DbRow[]>(this.sb.from('members').select('id').eq('user_id', user.id).limit(1))
      if (rows[0]) return String(rows[0].id)
    } catch (e) {
      if (!(e instanceof BackendError) || e.code !== 'auth') throw e
    }
    // Signed in, but no squad member uses this login (e.g. the coach reset it): start over.
    await this.dropSession()
    return null
  }

  async loginProfiles(): Promise<LoginProfile[]> {
    return (await this.profiles()).map(({ loginEmail: _hidden, ...p }) => p)
  }

  async signIn(slug: string, password: string): Promise<string> {
    const profile = await this.findProfile(slug)
    if (!profile) throw new BackendError('not_found', 'No such member')
    if (!profile.joined || !profile.loginEmail) throw new BackendError('auth', 'not joined')
    await this.passwordSignIn(profile.loginEmail, password)
    return profile.id
  }

  async join(slug: string, code: string, password: string): Promise<string> {
    const email = joinEmail(slug, code, this.domain)
    const profile = await this.findProfile(slug)
    if (!profile || !email) throw new BackendError('invalid_invite', 'This invite link is not valid.')
    if (profile.joined) {
      // Someone re-opening their own invite link can still get in with their password.
      if (profile.loginEmail?.toLowerCase() !== email) throw new BackendError('already_joined', 'Already joined. Sign in instead.')
      try {
        await this.passwordSignIn(email, password)
      } catch (e) {
        if (e instanceof BackendError && e.code === 'network') throw e
        throw new BackendError('already_joined', 'Already joined. Sign in instead.')
      }
    } else {
      await this.signUp(email, password)
    }
    try {
      // A wrong code resolves null (the database records the failed attempt; raising would roll that back).
      const id = await run<string | null>(this.sb.rpc('claim_invite', { p_slug: profile.slug, p_code: code.trim() }))
      if (!id) throw new BackendError('invalid_invite', 'This invite link is not valid (any more).')
      return String(id)
    } catch (e) {
      await this.dropSession()
      throw toBackendError(e)
    }
  }

  async signOut(): Promise<void> {
    this.signedUrls.clear()
    await this.dropSession()
  }

  async changePassword(newPassword: string): Promise<void> {
    const { error } = await call(() => this.sb.auth.updateUser({ password: newPassword }))
    if (error) throw toBackendError(error)
  }

  onSignedOut(cb: () => void): () => void {
    const { data } = this.sb.auth.onAuthStateChange((event) => {
      // Deferred: auth callbacks must not call back into supabase-js synchronously.
      if (event === 'SIGNED_OUT') setTimeout(cb, 0)
    })
    return () => data.subscription.unsubscribe()
  }

  private async profiles(): Promise<LoginProfileRow[]> {
    const rows = await run<Record<string, unknown>[]>(this.sb.rpc('login_profiles'))
    return (rows ?? []).map(loginProfileFromRpc)
  }

  private async findProfile(slug: string): Promise<LoginProfileRow | undefined> {
    const s = slug.trim().toLowerCase()
    return (await this.profiles()).find((p) => p.slug === s)
  }

  private async passwordSignIn(email: string, password: string): Promise<void> {
    const { error } = await call(() => this.sb.auth.signInWithPassword({ email, password }))
    if (error) throw toBackendError(error)
  }

  private async signUp(email: string, password: string): Promise<void> {
    const { data, error } = await call(() => this.sb.auth.signUp({ email, password }))
    if (error) {
      // Sign-up only sends (and rate-limits) e-mail while "Confirm email" is still on.
      if ((error as { code?: string }).code === 'over_email_send_rate_limit') {
        throw new BackendError('email_confirmation_on', 'E-mail confirmation is switched on in Supabase. Switch "Confirm email" off (see SETUP).')
      }
      if (!isUserAlreadyExists(error)) throw toBackendError(error)
      // The same invite was started before (e.g. the claim was lost to a network error): continue with it.
      try {
        await this.passwordSignIn(email, password)
      } catch (e) {
        if (e instanceof BackendError && e.code === 'auth') {
          throw new BackendError('auth', 'This invite was already started with another password. Use that one, or ask the coach for a new link.')
        }
        throw e
      }
      return
    }
    if (!data.session) {
      throw new BackendError('email_confirmation_on', 'E-mail confirmation is switched on in Supabase. Switch "Confirm email" off (see SETUP).')
    }
  }

  /** Sign out on this device only, even offline (a global sign-out would end the session on every phone). */
  private async dropSession(): Promise<void> {
    try {
      const { error } = await this.sb.auth.signOut({ scope: 'local' })
      if (!error) return
    } catch {
      /* fall through */
    }
    try {
      for (const k of [AUTH_STORAGE_KEY, `${AUTH_STORAGE_KEY}-code-verifier`, `${AUTH_STORAGE_KEY}-user`]) localStorage.removeItem(k)
    } catch {
      /* storage blocked */
    }
  }

  /* ---------------------------------------------------------------- data */

  async loadAll(): Promise<Snapshot> {
    await this.requireSession() // once up front: no table is read anonymously or half-way
    const entries = await Promise.all(TABLES.map(async (t) => [t, await this.readTable(t)] as const))
    return Object.fromEntries(entries) as unknown as Snapshot
  }

  private async readTable<T extends TableName>(table: T): Promise<Tables[T][]> {
    const out: Tables[T][] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const page = await this.data<DbRow[]>(() =>
        this.sb.from(SQL_TABLE[table]).select('*').order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1),
      )
      for (const r of page ?? []) {
        const row = fromRow(table, r)
        if (row) out.push(row)
      }
      if (!page || page.length < PAGE_SIZE) return out
    }
  }

  async put<T extends TableName>(table: T, row: Tables[T], changed?: string[]): Promise<Tables[T] | void> {
    if (table === 'programs' && (row as Program).builtIn) return // ships with the app
    if (table === 'members') return (await this.putMember(row as Member, changed)) as Tables[T]
    if (table === 'cheers') return this.putCheer(row as Cheer)
    await this.data(() => this.sb.from(SQL_TABLE[table]).upsert(toRow(table, row), { onConflict: 'id' }))
  }

  /**
   * Profiles are edited from two phones (the athlete's settings, the coach's goals and notes), so only the fields
   * this device changed are sent and merged into the stored profile (patch_member in schema.sql). Resolves the
   * merged profile, which includes whatever the other phone changed meanwhile.
   */
  private async putMember(m: Member, changed?: string[]): Promise<Member> {
    const args = { p_id: m.id, p_patch: memberDataPatch(m, changed), p_at: m.updatedAt }
    let rows: DbRow[]
    try {
      rows = await this.data<DbRow[]>(() => this.sb.rpc('patch_member', args))
    } catch (e) {
      // schema.sql from before patch_member (not re-run after an app update): replace the whole profile instead.
      if (!(e instanceof BackendError) || !/patch_member/.test(e.message) || e.code !== 'not_found') throw e
      rows = await this.data<DbRow[]>(() => this.sb.from('members').update(memberPatch(m)).eq('id', m.id).select('*'))
    }
    if (!rows?.[0]) throw new BackendError('forbidden', "You don't have permission to change this.")
    return memberFromRow(rows[0])
  }

  /**
   * The recipient of a cheer may only update it (mark it seen): an upsert is also an insert attempt, which the
   * database refuses for cheers sent by someone else. So: update first, insert when it doesn't exist yet.
   */
  private async putCheer(c: Cheer): Promise<void> {
    const row = toRow('cheers', c)
    const updated = await this.data<DbRow[]>(() =>
      this.sb.from('cheers').update({ data: row.data, updated_at: row.updated_at }).eq('id', c.id).select('id'),
    )
    if (updated?.length) return
    await this.data(() => this.sb.from('cheers').upsert(row, { onConflict: 'id' }))
  }

  async remove(table: TableName, id: string): Promise<void> {
    const sqlTable = SQL_TABLE[table]
    const deleted = await this.data<DbRow[]>(() => this.sb.from(sqlTable).delete().eq('id', id).select('id'))
    if (deleted?.length) return
    // Nothing deleted: fine if it is already gone, a refusal if it is still there (RLS skips rows silently).
    const still = await this.data<DbRow[]>(() => this.sb.from(sqlTable).select('id').eq('id', id).limit(1))
    if (still?.length) throw new BackendError('forbidden', "You don't have permission to delete this.")
  }

  subscribe(cb: (e: ChangeEvent) => void): () => void {
    const channel = this.sb.channel(`ect-db-${uuid()}`)
    for (const t of TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: SQL_TABLE[t] }, (payload) => {
        void this.emitChange(payload as unknown as RealtimePayload, cb)
      })
    }
    channel.subscribe()
    return () => {
      void this.sb.removeChannel(channel)
    }
  }

  /** Realtime drops oversized values (e.g. a big custom program); fetch such rows instead. */
  private async emitChange(p: RealtimePayload, cb: (e: ChangeEvent) => void): Promise<void> {
    const event = changeFromPayload(p)
    if (event) return cb(event)
    const table = tableFromSql(p.table)
    const id = p.new?.id
    if (!table || p.eventType === 'DELETE' || typeof id !== 'string') return
    try {
      const rows = await run<DbRow[]>(this.sb.from(p.table).select('*').eq('id', id).limit(1))
      const row = rows?.[0] ? fromRow(table, rows[0]) : null
      if (row) cb({ table, type: 'put', row } as ChangeEvent)
    } catch {
      /* the next refresh picks it up */
    }
  }

  /* ---------------------------------------------------------------- files */

  async uploadFile(memberId: string, file: File, bucket: string = BUCKET): Promise<FileRef> {
    if (file.size > MAX_FILE) throw new BackendError('too_large', 'File is larger than 15 MB')
    const type = contentTypeFor(file.name, file.type)
    const path = `${memberId}/${uuid()}-${safeFileName(file.name)}`
    await this.data(() => this.sb.storage.from(bucket).upload(path, file, { contentType: type, upsert: false }))
    return { path, name: file.name, type, size: file.size, ...(bucket === BUCKET ? {} : { bucket }) }
  }

  async fileUrl(ref: FileRef): Promise<string> {
    const cached = this.signedUrls.get(ref.path)
    if (cached && cached.expires > Date.now()) return cached.url
    const data = await this.data<{ signedUrl: string }>(() => this.sb.storage.from(bucketOf(ref)).createSignedUrl(ref.path, SIGNED_URL_TTL_S))
    if (!data?.signedUrl) throw new BackendError('not_found', 'File not found')
    // Reuse for most of its lifetime so re-renders don't request a new URL each time.
    this.signedUrls.set(ref.path, { url: data.signedUrl, expires: Date.now() + (SIGNED_URL_TTL_S - 600) * 1000 })
    return data.signedUrl
  }

  async deleteFile(ref: FileRef): Promise<void> {
    this.signedUrls.delete(ref.path)
    await this.data(() => this.sb.storage.from(bucketOf(ref)).remove([ref.path]))
  }

  /* ---------------------------------------------------------------- coach */

  async invites(): Promise<Record<string, string>> {
    const rows = await this.data<{ member_id: string; code: string }[]>(() => this.sb.from('member_invites').select('member_id, code'))
    return Object.fromEntries((rows ?? []).map((r) => [r.member_id, r.code]))
  }

  async resetInvite(memberId: string, detach: boolean): Promise<string> {
    return String(await this.data<string>(() => this.sb.rpc('reset_invite', { p_member: memberId, p_detach: detach })))
  }

  async createMember(input: { slug: string; name: string; role: 'coach' | 'athlete'; color: string }): Promise<string> {
    const id = await this.data<string>(() =>
      this.sb.rpc('create_member', { p_slug: input.slug, p_name: input.name, p_role: input.role, p_color: input.color }),
    )
    return String(id)
  }
}
