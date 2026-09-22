/**
 * Pure mapping between the app's domain rows and the Supabase tables (see supabase/schema.sql),
 * plus translation of Supabase / fetch errors into BackendError codes. No network here.
 */
import type { ChangeEvent, Cheer, LoginProfile, Member, MemberColor, Program, Role, TableName, Tables, WeightEntry, WorkoutLog } from '../types'
import { MEMBER_COLORS, TABLES } from '../types'
import { DEFAULT_PROGRAM_ID } from '../programs'
import type { BackendErrorCode } from './types'
import { BackendError } from './types'

export type Json = Record<string, unknown>

/** A row as PostgREST / Realtime return it. */
export interface DbRow {
  id: string
  data?: unknown
  updated_at?: number | string | null
  [column: string]: unknown
}

export const SQL_TABLE: Record<TableName, string> = {
  members: 'members',
  programs: 'programs',
  logs: 'workout_logs',
  weights: 'weights',
  mealPlans: 'meal_plans',
  checkins: 'checkins',
  cheers: 'cheers',
}

export const tableFromSql = (sqlTable: string): TableName | null => TABLES.find((t) => SQL_TABLE[t] === sqlTable) ?? null

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const toMs = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

/* ------------------------------------------------------------------ members */

type MemberProfile = Omit<Member, 'id' | 'slug' | 'role' | 'joined' | 'updatedAt'>
/** Columns of members that are not part of the editable `data` object. */
const MEMBER_COLUMNS = ['id', 'slug', 'role', 'joined', 'updatedAt'] as const

export function defaultMemberProfile(role: Role, slug: string): MemberProfile {
  return {
    name: slug,
    color: 'blue',
    competes: role === 'athlete',
    goal: '',
    goalWeightKg: null,
    heightCm: null,
    programId: DEFAULT_PROGRAM_ID,
    programStart: null,
    coachNote: '',
    coachNoteAt: null,
    settings: { unit: 'kg', machines: {}, weightVisibility: 'change' },
  }
}

export function memberFromRow(r: DbRow): Member {
  const role: Role = r.role === 'coach' ? 'coach' : 'athlete'
  const slug = String(r.slug ?? '')
  const data = isObj(r.data) ? r.data : {}
  const base = defaultMemberProfile(role, slug)
  const color = MEMBER_COLORS.includes(data.color as MemberColor) ? (data.color as MemberColor) : base.color
  const settings = { ...base.settings, ...(isObj(data.settings) ? data.settings : {}) }
  return {
    ...base,
    ...data,
    name: typeof data.name === 'string' && data.name ? data.name : base.name,
    color,
    settings,
    id: String(r.id),
    slug,
    role,
    joined: r.user_id != null,
    updatedAt: toMs(r.updated_at),
  } as Member
}

/** What a member write sends: only the profile data and the timestamp (never slug, role or login). */
export function memberPatch(m: Member): { data: Json; updated_at: number } {
  const data: Json = { ...m }
  for (const k of MEMBER_COLUMNS) delete data[k]
  return { data, updated_at: m.updatedAt }
}

/* ------------------------------------------------------------------ all tables */

/** Domain row -> table row. The whole object goes into `data`; columns duplicate what RLS and uniqueness need. */
export function toRow<T extends TableName>(table: T, row: Tables[T]): Json {
  const t: TableName = table
  const base = { id: row.id, data: { ...row } as Json, updated_at: row.updatedAt }
  switch (t) {
    case 'members':
      return { id: row.id, ...memberPatch(row as Member) }
    case 'programs': {
      const p = row as Program
      return { ...base, data: { ...p, builtIn: false }, created_by: isUuid(p.createdBy) ? p.createdBy : null }
    }
    case 'logs':
    case 'mealPlans':
      return { ...base, member_id: (row as WorkoutLog).memberId }
    case 'weights':
    case 'checkins': {
      const r = row as WeightEntry
      return { ...base, member_id: r.memberId, date: r.date }
    }
    case 'cheers': {
      const c = row as Cheer
      return { ...base, from_id: c.fromId, to_id: c.toId, created_at: c.createdAt }
    }
  }
}

/** Table row -> domain row, or null when the row carries no usable data. */
export function fromRow<T extends TableName>(table: T, r: DbRow): Tables[T] | null {
  if (!r || r.id == null) return null
  if (table === 'members') return memberFromRow(r) as Tables[T]
  if (!isObj(r.data)) return null
  const row: Json = { ...r.data, id: String(r.id), updatedAt: toMs(r.updated_at ?? r.data.updatedAt) }
  if (table === 'programs') {
    row.builtIn = false
    if (row.createdBy === undefined) row.createdBy = r.created_by ?? null
  }
  return row as unknown as Tables[T]
}

/* ------------------------------------------------------------------ realtime */

export interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  new: Json
  old: Json
}

/** Realtime message -> store event. Null when it can't be mapped (unknown table, or a payload without data). */
export function changeFromPayload(p: RealtimePayload): ChangeEvent | null {
  const table = tableFromSql(p.table)
  if (!table) return null
  if (p.eventType === 'DELETE') {
    const id = p.old?.id
    return id == null ? null : { table, type: 'remove', id: String(id) }
  }
  const row = p.new && fromRow(table, p.new as DbRow)
  return row ? ({ table, type: 'put', row } as ChangeEvent) : null
}

/* ------------------------------------------------------------------ auth + files */

export interface LoginProfileRow extends LoginProfile {
  loginEmail: string | null
}

export function loginProfileFromRpc(r: Json): LoginProfileRow {
  const role: Role = r.role === 'coach' ? 'coach' : 'athlete'
  const slug = String(r.slug ?? '')
  return {
    id: String(r.id),
    slug,
    name: typeof r.name === 'string' && r.name ? r.name : slug,
    color: MEMBER_COLORS.includes(r.color as MemberColor) ? (r.color as MemberColor) : 'blue',
    role,
    joined: r.joined === true,
    loginEmail: typeof r.login_email === 'string' && r.login_email ? r.login_email : null,
  }
}

/** The hidden login e-mail for a join: `<slug>-<code>@<domain>` (a fresh one per invite, so re-joining works). "" if unusable. */
export function joinEmail(slug: string, code: string, domain: string): string {
  const s = slug.trim().toLowerCase()
  const c = code.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return s && c ? `${s}-${c}@${domain.trim().toLowerCase()}` : ''
}

/** A storage-safe key segment (ASCII only); the original name is kept in FileRef.name. */
export function safeFileName(name: string): string {
  const ascii = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
  const ext = ascii.match(/\.[a-z0-9]{1,8}$/i)?.[0] ?? ''
  const stem = ascii.slice(0, ascii.length - ext.length).replace(/^[_.-]+|[_.-]+$/g, '') || 'file'
  return stem.slice(0, 80 - ext.length) + ext.toLowerCase()
}

const TYPES_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heic',
  gif: 'image/gif',
  txt: 'text/plain',
}

/** Browsers often send "" (or octet-stream) for HEIC photos and some PDFs; the bucket only accepts known types. */
export function contentTypeFor(name: string, type: string): string {
  const t = type.trim().toLowerCase()
  if (t === 'image/jpg') return 'image/jpeg'
  if (t === 'image/heif') return 'image/heic'
  if (t && t !== 'application/octet-stream') return t
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return TYPES_BY_EXT[ext] ?? (t || 'application/octet-stream')
}

/* ------------------------------------------------------------------ errors */

interface ErrorInfo {
  message: string
  code: string
  status: number | null
  name: string
  details: string
}

function errorInfo(e: unknown, status?: number): ErrorInfo {
  const o: Json = isObj(e) || e instanceof Error ? (e as unknown as Json) : {}
  const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
  const num = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v))
  const inner = isObj(o.originalError) || o.originalError instanceof Error ? (o.originalError as Json) : null
  return {
    message: typeof e === 'string' ? e : str(o.message) || str(o.error_description) || str(o.msg) || str(o.error),
    code: str(o.code) || str(o.error_code),
    status: status ?? num(o.status) ?? num(o.statusCode),
    name: str(o.name) || str(inner?.name),
    details: [str(o.details), str(o.hint), str(inner?.message)].join(' '),
  }
}

const NETWORK_RE = /failed to fetch|networkerror|network error|network request failed|load failed|fetch failed|timed? ?out|econn(refused|reset)|enotfound|socket hang up/i

export const isUserAlreadyExists = (e: unknown): boolean => {
  const { code, message } = errorInfo(e)
  return code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered|already exists/i.test(message)
}

/** Any thrown value -> BackendError, so the store can tell retryable (network) failures from permanent ones. */
export function toBackendError(e: unknown, status?: number): BackendError {
  if (e instanceof BackendError) return e
  const { message, code, status: st, name, details } = errorInfo(e, status)
  const err = (c: BackendErrorCode, m?: string) => new BackendError(c, m || message || c)

  // Exceptions raised by our SQL functions.
  if (/\binvalid_invite\b/.test(message)) return err('invalid_invite', 'This invite link is not valid (any more).')
  if (/\balready_joined\b/.test(message)) return err('already_joined', 'This member has already joined. Sign in instead.')
  if (/\balready_linked\b/.test(message)) return err('conflict', 'This login already belongs to another member.')
  if (/\bslug_taken\b/.test(message)) return err('conflict', 'That handle is already taken.')
  if (/\binvalid_slug\b/.test(message)) return err('unknown', 'Handles are 2-24 lowercase letters, digits or dashes.')
  if (message === 'not_found') return err('not_found', 'Not found.')

  if (
    name === 'AbortError' ||
    code === 'ABORT_ERR' ||
    name === 'AuthRetryableFetchError' ||
    st === 0 ||
    (st != null && st >= 502 && st <= 504) ||
    /^PGRST00[0-3]$/.test(code) ||
    NETWORK_RE.test(message) ||
    (name === 'StorageUnknownError' && NETWORK_RE.test(details))
  ) {
    return err('network', 'No connection. Changes are saved on this device and sync later.')
  }

  if (code === 'email_not_confirmed' || /email not confirmed|confirmation (is )?required|requires? (e-?mail )?confirmation/i.test(message)) {
    return err('email_confirmation_on', 'E-mail confirmation is switched on in Supabase. Switch "Confirm email" off (see SETUP).')
  }
  if (
    code === 'weak_password' ||
    code === 'same_password' ||
    name === 'AuthWeakPasswordError' ||
    (/password/i.test(message) && /at least|characters|too short|weak|should|must|pwned|known/i.test(message))
  ) {
    return err('weak_password')
  }
  if (
    ['invalid_credentials', 'bad_jwt', 'session_not_found', 'session_expired', 'refresh_token_not_found', 'user_not_found'].includes(code) ||
    /^PGRST30[0-3]$/.test(code) ||
    code === '28000' ||
    name === 'AuthSessionMissingError' ||
    st === 401 ||
    /invalid login credentials|jwt expired|invalid jwt|auth session missing|invalid refresh token/i.test(message)
  ) {
    return err('auth')
  }
  if (code === '42501' || st === 403 || code === 'signup_disabled' || /row-level security|row level security|permission denied|not allowed/i.test(message)) {
    return err('forbidden', "You don't have permission to do that.")
  }
  if (st === 413 || /payload too large|maximum allowed size|entitytoolarge|too large/i.test(message)) {
    return err('too_large', 'File is larger than 15 MB')
  }
  if (code === '23505' || st === 409 || /duplicate key|already registered/i.test(message)) return err('conflict')
  if (code === 'PGRST116' || st === 404 || /not found/i.test(message)) return err('not_found')
  return err('unknown', message || String(e))
}
