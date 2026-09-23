import type { ChangeEvent, FileRef, LoginProfile, Snapshot, TableName, Tables } from '../types'

/**
 * Storage + auth provider. Two implementations:
 * - LocalBackend ("demo"): everything in this browser, seeded with demo data, no passwords.
 * - SupabaseBackend ("supabase"): shared Postgres + Auth + Storage, used when config provides a Supabase URL and anon key.
 *
 * Every method may throw a BackendError. Network failures must be thrown with code "network" so the store
 * can keep the write in its outbox and retry later.
 */
export interface Backend {
  readonly kind: 'demo' | 'supabase'

  /** Connect / restore session. Resolves the signed-in member id, or null when signed out. */
  init(): Promise<string | null>

  /** Members shown on the login screen (works while signed out). */
  loginProfiles(): Promise<LoginProfile[]>
  /** Sign in as a member. Demo mode ignores the password. Resolves the member id. */
  signIn(slug: string, password: string): Promise<string>
  /** Claim a member profile with the invite code the coach shared, choosing a password. Resolves the member id. */
  join(slug: string, code: string, password: string): Promise<string>
  signOut(): Promise<void>
  changePassword(newPassword: string): Promise<void>
  /** Called when the session ends elsewhere (expired / signed out in another tab). */
  onSignedOut(cb: () => void): () => void

  /** Everything the signed-in member may read. Built-in programs are NOT included (the store adds them). */
  loadAll(): Promise<Snapshot>
  /**
   * Write a row. `changed` lists the fields this device changed since its copy was current (top-level keys, or
   * "settings.unit" for one nested key); members are merged on the server by these keys, so two devices editing
   * different fields of one profile never overwrite each other. Undefined = the whole row.
   * Resolves the row as the server stored it when that is known (the store adopts it), else void.
   */
  put<T extends TableName>(table: T, row: Tables[T], changed?: string[]): Promise<Tables[T] | void>
  remove(table: TableName, id: string): Promise<void>
  /** Live changes made by others (and echoes of our own writes, which the store ignores by LWW). */
  subscribe(cb: (e: ChangeEvent) => void): () => void

  uploadFile(memberId: string, file: File, bucket?: string): Promise<FileRef>
  /** A URL the browser can open/embed (signed or object URL). */
  fileUrl(ref: FileRef): Promise<string>
  deleteFile(ref: FileRef): Promise<void>

  /** Coach only: invite codes by member id (members that have not joined yet, and joined ones). */
  invites(): Promise<Record<string, string>>
  /** Coach only: issue a fresh invite code for a member; also detaches the old login if `detach` is true. */
  resetInvite(memberId: string, detach: boolean): Promise<string>
  /** Coach only: add a new member (e.g. a new friend joins the squad). Resolves the new member's id. */
  createMember(input: { slug: string; name: string; role: 'coach' | 'athlete'; color: string }): Promise<string>
}

export type BackendErrorCode =
  | 'network'
  | 'auth' // wrong password / not signed in
  | 'forbidden' // row level security refused
  | 'invalid_invite'
  | 'already_joined'
  | 'weak_password'
  | 'email_confirmation_on' // Supabase project still requires e-mail confirmation
  | 'not_found'
  | 'conflict'
  | 'too_large'
  | 'rate_limited' // too many attempts / requests: wait and try again
  | 'unavailable' // the server failed or is overloaded (5xx, 408): try again later
  | 'config' // the deployment is misconfigured (e.g. the secret key or a rejected e-mail domain in config.js)
  | 'unknown'

export class BackendError extends Error {
  readonly code: BackendErrorCode
  constructor(code: BackendErrorCode, message?: string) {
    super(message || code)
    this.code = code
    this.name = 'BackendError'
  }
}

/** Failures that may succeed later without anyone changing anything: the outbox keeps such writes and retries. */
export const isRetryable = (e: unknown): boolean =>
  e instanceof BackendError ? e.code === 'network' || e.code === 'rate_limited' || e.code === 'unavailable' : true
