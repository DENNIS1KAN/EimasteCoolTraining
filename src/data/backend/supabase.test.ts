import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Cheer, Member, Program, WorkoutLog } from '../types'
import { BackendError } from './types'
import { PAGE_SIZE, SupabaseBackend } from './supabase'

/* ------------------------------------------------------------------ fake supabase-js client */

interface Query {
  table?: string
  rpc?: string
  args?: unknown
  op: 'select' | 'update' | 'upsert' | 'delete' | 'rpc'
  payload?: unknown
  options?: unknown
  columns?: string
  filters: [string, unknown][]
  range?: [number, number]
}
interface Res {
  data: unknown
  error: unknown
  status?: number
}
type Handler = (q: Query) => Res

const fake = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => fake.client) }))

const ok = (data: unknown): Res => ({ data, error: null, status: 200 })
const offline: Res = { data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }, status: 0 }

function makeClient() {
  const queries: Query[] = []
  let handler: Handler = () => ok([])
  const realtime: { table: string; cb: (p: unknown) => void }[] = []
  let authListener: ((event: string) => void) | null = null

  const builder = (q: Query) => {
    const b = {
      select: (columns?: string) => ((q.columns = columns), b),
      order: () => b,
      limit: () => b,
      range: (from: number, to: number) => ((q.range = [from, to]), b),
      eq: (col: string, v: unknown) => (q.filters.push([col, v]), b),
      update: (payload: unknown) => ((q.op = 'update'), (q.payload = payload), b),
      upsert: (payload: unknown, options?: unknown) => ((q.op = 'upsert'), (q.payload = payload), (q.options = options), b),
      delete: () => ((q.op = 'delete'), b),
      then: (resolve: (r: Res) => unknown, reject: (e: unknown) => unknown) => {
        queries.push(q)
        return Promise.resolve()
          .then(() => handler(q))
          .then(resolve, reject)
      },
    }
    return b
  }

  const bucket = {
    upload: vi.fn(async (path: string) => ({ data: { path }, error: null })),
    createSignedUrl: vi.fn(async (path: string) => ({ data: { signedUrl: `https://signed/${path}` }, error: null })),
    remove: vi.fn(async () => ({ data: [], error: null })),
  }
  const channel = {
    on: vi.fn((_type: string, filter: { table: string }, cb: (p: unknown) => void) => (realtime.push({ table: filter.table, cb }), channel)),
    subscribe: vi.fn(() => channel),
  }
  const client = {
    from: vi.fn((table: string) => builder({ table, op: 'select', filters: [] })),
    rpc: vi.fn((name: string, args?: unknown) => builder({ rpc: name, args, op: 'rpc', filters: [] })),
    auth: {
      getSession: vi.fn(async (): Promise<{ data: { session: unknown }; error: unknown }> => ({ data: { session: null }, error: null })),
      signInWithPassword: vi.fn(async (): Promise<{ data: unknown; error: unknown }> => ({ data: { session: { access_token: 't' } }, error: null })),
      signUp: vi.fn(async (): Promise<{ data: { session: unknown }; error: unknown }> => ({ data: { session: { access_token: 't' } }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      updateUser: vi.fn(async (): Promise<{ data: unknown; error: unknown }> => ({ data: {}, error: null })),
      onAuthStateChange: vi.fn((cb: (event: string) => void) => {
        authListener = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
    },
    storage: { from: vi.fn(() => bucket) },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => 'ok'),
  }
  return {
    client,
    bucket,
    channel,
    queries,
    realtime,
    handle: (h: Handler) => {
      handler = h
    },
    emitAuth: (event: string) => authListener?.(event),
  }
}

const PROFILES = [
  { id: 'id-dennis', slug: 'dennis', name: 'Dennis', color: 'aqua', role: 'coach', joined: true, login_email: 'dennis-aaaaaa@eimastecool.app' },
  { id: 'id-stelios', slug: 'stelios', name: 'Stelios', color: 'blue', role: 'athlete', joined: false, login_email: null },
]

let sb: ReturnType<typeof makeClient>
let backend: SupabaseBackend

beforeEach(() => {
  sb = makeClient()
  fake.client = sb.client
  backend = new SupabaseBackend({ supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'k'.repeat(40), authEmailDomain: 'eimastecool.app' })
})

const rejection = async (p: Promise<unknown>): Promise<BackendError> => {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(BackendError)
    return e as BackendError
  }
  throw new Error('expected a rejection')
}

/** Answers login_profiles and claim_invite; everything else goes to `rest`. */
const authFlow =
  (claim: Res = ok('id-stelios'), rest: Handler = () => ok([])): Handler =>
  (q) =>
    q.rpc === 'login_profiles' ? ok(PROFILES) : q.rpc === 'claim_invite' ? claim : rest(q)

const logRow = (i: number) => ({ id: `log-${String(i).padStart(5, '0')}`, member_id: 'm1', data: { id: `log-${i}`, memberId: 'm1', week: 1 }, updated_at: i })

/* ------------------------------------------------------------------ tests */

describe('loadAll', () => {
  it('reads every table in pages until a short page', async () => {
    const total = 2500
    sb.handle((q) => {
      if (q.table === 'workout_logs') {
        const [from, to] = q.range!
        return ok(Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, k) => logRow(from + k)))
      }
      if (q.table === 'members') return ok([{ id: 'm1', slug: 'stelios', role: 'athlete', user_id: 'u1', data: { name: 'Stelios' }, updated_at: 3 }])
      return ok([])
    })
    const snap = await backend.loadAll()
    expect(snap.logs).toHaveLength(total)
    expect(snap.logs[0]).toMatchObject({ id: 'log-00000', memberId: 'm1', updatedAt: 0 })
    expect(snap.members).toEqual([expect.objectContaining({ id: 'm1', name: 'Stelios', joined: true, updatedAt: 3 })])
    expect(sb.queries.filter((q) => q.table === 'workout_logs').map((q) => q.range)).toEqual([
      [0, PAGE_SIZE - 1],
      [PAGE_SIZE, 2 * PAGE_SIZE - 1],
      [2 * PAGE_SIZE, 3 * PAGE_SIZE - 1],
    ])
    const tables = new Set(sb.queries.map((q) => q.table))
    expect([...tables].sort()).toEqual(['checkins', 'cheers', 'meal_plans', 'members', 'programs', 'weights', 'workout_logs'])
  })

  it('asks for one more page after a full one', async () => {
    sb.handle((q) => (q.table === 'weights' && q.range![0] === 0 ? ok(Array.from({ length: PAGE_SIZE }, (_, i) => logRow(i))) : ok([])))
    await backend.loadAll()
    expect(sb.queries.filter((q) => q.table === 'weights')).toHaveLength(2)
  })

  it('reports a lost connection as a network error', async () => {
    sb.handle(() => offline)
    expect((await rejection(backend.loadAll())).code).toBe('network')
  })
})

describe('init', () => {
  it('is signed out without a session', async () => {
    expect(await backend.init()).toBeNull()
  })

  it('resolves the member linked to the session user', async () => {
    sb.client.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } }, error: null })
    sb.handle((q) => (q.table === 'members' ? ok([{ id: 'id-stelios' }]) : ok([])))
    expect(await backend.init()).toBe('id-stelios')
    expect(sb.queries[0].filters).toEqual([['user_id', 'u1']])
  })

  it('drops a session that no member uses any more', async () => {
    sb.client.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } }, error: null })
    expect(await backend.init()).toBeNull()
    expect(sb.client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('throws network errors (so the app opens from its cache) but signs out on a revoked session', async () => {
    sb.client.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 } })
    expect((await rejection(backend.init())).code).toBe('network')
    sb.client.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: { name: 'AuthApiError', message: 'Invalid Refresh Token: Refresh Token Not Found', status: 400, code: 'refresh_token_not_found' },
    })
    expect(await backend.init()).toBeNull()
    expect(sb.client.auth.signOut).toHaveBeenCalled()
  })
})

describe('signIn', () => {
  beforeEach(() => sb.handle(authFlow()))

  it('signs in with the login e-mail of a joined member', async () => {
    expect(await backend.signIn('dennis', 'secret1')).toBe('id-dennis')
    expect(sb.client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'dennis-aaaaaa@eimastecool.app', password: 'secret1' })
  })

  it('refuses members who have not joined yet', async () => {
    const e = await rejection(backend.signIn('stelios', 'secret1'))
    expect([e.code, e.message]).toEqual(['auth', 'not joined'])
    expect(sb.client.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('maps a wrong password and unknown members', async () => {
    sb.client.auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { name: 'AuthApiError', message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' },
    })
    expect((await rejection(backend.signIn('dennis', 'nope'))).code).toBe('auth')
    expect((await rejection(backend.signIn('nobody', 'x'))).code).toBe('not_found')
  })

  it('lists login profiles without their e-mails', async () => {
    const profiles = await backend.loginProfiles()
    expect(profiles[0]).toEqual({ id: 'id-dennis', slug: 'dennis', name: 'Dennis', color: 'aqua', role: 'coach', joined: true })
  })
})

describe('join', () => {
  it('signs up with the invite e-mail and claims the member', async () => {
    sb.handle(authFlow())
    expect(await backend.join('stelios', ' abc234 ', 'secret1')).toBe('id-stelios')
    expect(sb.client.auth.signUp).toHaveBeenCalledWith({ email: 'stelios-abc234@eimastecool.app', password: 'secret1' })
    expect(sb.client.rpc).toHaveBeenCalledWith('claim_invite', { p_slug: 'stelios', p_code: 'abc234' })
    expect(sb.client.auth.signOut).not.toHaveBeenCalled()
  })

  it('continues an invite that was started before (user already exists)', async () => {
    sb.handle(authFlow())
    sb.client.auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: { message: 'User already registered', status: 422, code: 'user_already_exists' } })
    expect(await backend.join('stelios', 'ABC234', 'secret1')).toBe('id-stelios')
    expect(sb.client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'stelios-abc234@eimastecool.app', password: 'secret1' })
  })

  it('explains a started invite with a different password', async () => {
    sb.handle(authFlow())
    sb.client.auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: { message: 'User already registered', status: 422, code: 'user_already_exists' } })
    sb.client.auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' } })
    const e = await rejection(backend.join('stelios', 'ABC234', 'other'))
    expect(e.code).toBe('auth')
    expect(e.message).toMatch(/another password/)
  })

  it('detects e-mail confirmation being on', async () => {
    sb.handle(authFlow())
    sb.client.auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: null })
    expect((await rejection(backend.join('stelios', 'ABC234', 'secret1'))).code).toBe('email_confirmation_on')
    expect(sb.client.rpc).not.toHaveBeenCalledWith('claim_invite', expect.anything())
  })

  it('reports weak passwords before claiming', async () => {
    sb.handle(authFlow())
    sb.client.auth.signUp.mockResolvedValueOnce({
      data: { session: null },
      error: { name: 'AuthWeakPasswordError', message: 'Password should be at least 6 characters.', status: 422, code: 'weak_password' },
    })
    expect((await rejection(backend.join('stelios', 'ABC234', '123'))).code).toBe('weak_password')
    expect(sb.client.rpc).not.toHaveBeenCalledWith('claim_invite', expect.anything())
  })

  it('signs out again when the claim fails', async () => {
    sb.handle(authFlow({ data: null, error: { message: 'invalid_invite', code: 'P0001' }, status: 400 }))
    expect((await rejection(backend.join('stelios', 'WRONG1', 'secret1'))).code).toBe('invalid_invite')
    expect(sb.client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('refuses unknown members and members who joined with another link, without touching auth', async () => {
    sb.handle(authFlow())
    expect((await rejection(backend.join('nobody', 'ABC234', 'secret1'))).code).toBe('invalid_invite')
    expect((await rejection(backend.join('dennis', 'ZZZZZZ', 'secret1'))).code).toBe('already_joined')
    expect(sb.client.auth.signUp).not.toHaveBeenCalled()
    expect(sb.client.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('lets a joined member re-open their own invite link with their password', async () => {
    sb.handle(authFlow(ok('id-dennis')))
    expect(await backend.join('dennis', 'AAAAAA', 'secret1')).toBe('id-dennis')
    expect(sb.client.auth.signUp).not.toHaveBeenCalled()
  })

  it('reports the network when offline', async () => {
    sb.handle(() => offline)
    expect((await rejection(backend.join('stelios', 'ABC234', 'secret1'))).code).toBe('network')
  })
})

describe('session events', () => {
  it('reports sign-outs from elsewhere', async () => {
    const cb = vi.fn()
    const off = backend.onSignedOut(cb)
    sb.emitAuth('TOKEN_REFRESHED')
    sb.emitAuth('SIGNED_OUT')
    await new Promise((r) => setTimeout(r, 0))
    expect(cb).toHaveBeenCalledTimes(1)
    off()
  })

  it('changes the password and maps refusals', async () => {
    await backend.changePassword('longer-secret')
    expect(sb.client.auth.updateUser).toHaveBeenCalledWith({ password: 'longer-secret' })
    sb.client.auth.updateUser.mockResolvedValueOnce({ data: {}, error: { message: 'Password should be at least 6 characters.', code: 'weak_password' } })
    expect((await rejection(backend.changePassword('1'))).code).toBe('weak_password')
  })
})

describe('writes', () => {
  const member = { id: 'id-stelios', slug: 'stelios', role: 'athlete', joined: true, name: 'Stelios', updatedAt: 9 } as Member
  const log = { id: 'id-stelios__bts-12__w1d0', memberId: 'id-stelios', updatedAt: 5 } as WorkoutLog
  const cheer = { id: 'c1', fromId: 'a', toId: 'b', createdAt: 1, seenAt: 2, updatedAt: 3 } as Cheer

  it('never writes built-in programs', async () => {
    await backend.put('programs', { id: 'bts-12', builtIn: true } as Program)
    expect(sb.queries).toHaveLength(0)
  })

  it('updates only the profile data of a member', async () => {
    sb.handle(() => ok([{ id: 'id-stelios' }]))
    await backend.put('members', member)
    const q = sb.queries[0]
    expect([q.table, q.op, q.filters]).toEqual(['members', 'update', [['id', 'id-stelios']]])
    expect(q.payload).toEqual({ data: { name: 'Stelios' }, updated_at: 9 })
  })

  it('reports a member update that changed nothing as forbidden', async () => {
    sb.handle(() => ok([]))
    expect((await rejection(backend.put('members', member))).code).toBe('forbidden')
  })

  it('upserts data rows by id', async () => {
    await backend.put('logs', log)
    const q = sb.queries[0]
    expect([q.table, q.op, q.options]).toEqual(['workout_logs', 'upsert', { onConflict: 'id' }])
    expect(q.payload).toEqual({ id: log.id, member_id: 'id-stelios', data: log, updated_at: 5 })
  })

  it('maps refusals and network errors on write', async () => {
    sb.handle(() => ({ data: null, error: { message: 'new row violates row-level security policy for table "workout_logs"', code: '42501' }, status: 403 }))
    expect((await rejection(backend.put('logs', log))).code).toBe('forbidden')
    sb.handle(() => offline)
    expect((await rejection(backend.put('logs', log))).code).toBe('network')
  })

  it('updates existing cheers (recipients may only update) and inserts new ones', async () => {
    sb.handle((q) => (q.op === 'update' ? ok([{ id: 'c1' }]) : ok(null)))
    await backend.put('cheers', cheer)
    expect(sb.queries.map((q) => q.op)).toEqual(['update'])
    expect(sb.queries[0].payload).toEqual({ data: cheer, updated_at: 3 })

    sb.queries.length = 0
    sb.handle((q) => (q.op === 'update' ? ok([]) : ok(null)))
    await backend.put('cheers', cheer)
    expect(sb.queries.map((q) => q.op)).toEqual(['update', 'upsert'])
    expect(sb.queries[1].payload).toMatchObject({ from_id: 'a', to_id: 'b', created_at: 1 })
  })

  it('deletes, and tells "already gone" from "not allowed"', async () => {
    sb.handle(() => ok([{ id: 'x' }]))
    await backend.remove('weights', 'x')
    expect(sb.queries.map((q) => [q.table, q.op])).toEqual([['weights', 'delete']])

    sb.queries.length = 0
    sb.handle(() => ok([]))
    await backend.remove('weights', 'x')
    expect(sb.queries.map((q) => q.op)).toEqual(['delete', 'select'])

    sb.handle((q) => (q.op === 'delete' ? ok([]) : ok([{ id: 'x' }])))
    expect((await rejection(backend.remove('mealPlans', 'x'))).code).toBe('forbidden')
  })
})

describe('realtime', () => {
  it('listens to the 7 tables on one channel and maps events', async () => {
    const events: unknown[] = []
    const off = backend.subscribe((e) => events.push(e))
    expect(sb.client.channel).toHaveBeenCalledTimes(1)
    expect(sb.realtime.map((r) => r.table).sort()).toEqual(['checkins', 'cheers', 'meal_plans', 'members', 'programs', 'weights', 'workout_logs'])
    expect(sb.channel.subscribe).toHaveBeenCalled()

    const logs = sb.realtime.find((r) => r.table === 'workout_logs')!
    logs.cb({ eventType: 'INSERT', table: 'workout_logs', new: logRow(7), old: {} })
    logs.cb({ eventType: 'DELETE', table: 'workout_logs', new: {}, old: { id: 'log-7' } })
    await new Promise((r) => setTimeout(r, 0))
    expect(events).toEqual([
      { table: 'logs', type: 'put', row: expect.objectContaining({ id: 'log-00007', updatedAt: 7 }) },
      { table: 'logs', type: 'remove', id: 'log-7' },
    ])
    off()
    expect(sb.client.removeChannel).toHaveBeenCalled()
  })

  it('fetches rows whose payload came without data', async () => {
    const events: unknown[] = []
    backend.subscribe((e) => events.push(e))
    sb.handle(() => ok([{ id: 'p1', data: { id: 'p1', name: 'Big program', builtIn: true }, updated_at: 4, created_by: null }]))
    sb.realtime.find((r) => r.table === 'programs')!.cb({ eventType: 'UPDATE', table: 'programs', new: { id: 'p1' }, old: {} })
    await vi.waitFor(() => expect(events).toHaveLength(1))
    expect(events[0]).toEqual({ table: 'programs', type: 'put', row: { id: 'p1', name: 'Big program', builtIn: false, createdBy: null, updatedAt: 4 } })
  })
})

describe('files', () => {
  it('uploads under the member folder with a safe name and a content type', async () => {
    const file = new File(['%PDF'], 'Διατροφή plan.PDF', { type: '' })
    const ref = await backend.uploadFile('id-stelios', file)
    expect(ref.path).toMatch(/^id-stelios\/[0-9a-f-]{36}-plan\.pdf$/)
    expect(ref).toMatchObject({ name: 'Διατροφή plan.PDF', type: 'application/pdf', size: 4 })
    expect(sb.bucket.upload).toHaveBeenCalledWith(ref.path, file, { contentType: 'application/pdf', upsert: false })
    expect(sb.client.storage.from).toHaveBeenCalledWith('meal-plans')
  })

  it('refuses files over 15 MB before uploading', async () => {
    const file = new File(['x'], 'huge.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 16 * 1024 * 1024 })
    expect((await rejection(backend.uploadFile('id-stelios', file))).code).toBe('too_large')
    expect(sb.bucket.upload).not.toHaveBeenCalled()
  })

  it('maps upload failures', async () => {
    sb.bucket.upload.mockResolvedValueOnce({ data: null, error: { name: 'StorageApiError', message: 'new row violates row-level security policy', status: 400, statusCode: '403' } } as never)
    expect((await rejection(backend.uploadFile('id-thanos', new File(['x'], 'a.png', { type: 'image/png' })))).code).toBe('forbidden')
  })

  it('signs URLs for an hour and reuses them', async () => {
    const ref = { path: 'id-stelios/1-plan.pdf', name: 'plan.pdf', type: 'application/pdf', size: 1 }
    expect(await backend.fileUrl(ref)).toBe('https://signed/id-stelios/1-plan.pdf')
    await backend.fileUrl(ref)
    expect(sb.bucket.createSignedUrl).toHaveBeenCalledTimes(1)
    expect(sb.bucket.createSignedUrl).toHaveBeenCalledWith(ref.path, 3600)
    await backend.deleteFile(ref)
    expect(sb.bucket.remove).toHaveBeenCalledWith([ref.path])
  })
})

describe('coach tools', () => {
  it('reads invites and calls the coach RPCs', async () => {
    sb.handle((q) =>
      q.table === 'member_invites'
        ? ok([{ member_id: 'id-stelios', code: 'ABC234' }])
        : q.rpc === 'reset_invite'
          ? ok('NEWCDE')
          : q.rpc === 'create_member'
            ? ok('id-eleni')
            : ok([]),
    )
    expect(await backend.invites()).toEqual({ 'id-stelios': 'ABC234' })
    expect(await backend.resetInvite('id-stelios', true)).toBe('NEWCDE')
    expect(sb.client.rpc).toHaveBeenCalledWith('reset_invite', { p_member: 'id-stelios', p_detach: true })
    expect(await backend.createMember({ slug: 'eleni', name: 'Eleni', role: 'athlete', color: 'green' })).toBe('id-eleni')
    expect(sb.client.rpc).toHaveBeenCalledWith('create_member', { p_slug: 'eleni', p_name: 'Eleni', p_role: 'athlete', p_color: 'green' })
  })

  it('maps coach-only refusals and taken handles', async () => {
    sb.handle(() => ({ data: null, error: { message: 'forbidden', code: '42501' }, status: 403 }))
    expect((await rejection(backend.resetInvite('x', false))).code).toBe('forbidden')
    sb.handle(() => ({ data: null, error: { message: 'slug_taken', code: '23505' }, status: 409 }))
    expect((await rejection(backend.createMember({ slug: 'dennis', name: 'D', role: 'athlete', color: 'red' }))).code).toBe('conflict')
  })
})
