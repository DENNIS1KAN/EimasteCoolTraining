/**
 * The real supabase-js client with a scripted network: a write must never reach the database with the anon key
 * (which the server refuses, and which used to make the app throw the write away and sign out).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkoutLog } from '../types'
import { BackendError } from './types'
import { SupabaseBackend } from './supabase'

const URL_ = 'https://abcd.supabase.co'
const ANON = 'anon-key-0123456789abcdefghijklmnop'
const log = { id: 'L', memberId: 'm1', updatedAt: 5 } as WorkoutLog

type Call = { url: string; auth: string | null }
let calls: Call[] = []
let network: (url: string) => Response | 'offline'

function storeSession(expiresInS: number) {
  const now = Math.floor(Date.now() / 1000)
  localStorage.setItem(
    'ect-auth',
    JSON.stringify({
      access_token: 'user-jwt',
      refresh_token: 'refresh-1',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + expiresInS,
      user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'stelios-abc@x.example.org' },
    }),
  )
}

let backend: SupabaseBackend | null = null
const make = () => (backend = new SupabaseBackend({ supabaseUrl: URL_, supabaseAnonKey: ANON, authEmailDomain: 'x.example.org' }))
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p
    return 'ok'
  } catch (e) {
    expect(e).toBeInstanceOf(BackendError)
    return (e as BackendError).code
  }
}

beforeEach(() => {
  localStorage.clear()
  calls = []
  network = () => new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      calls.push({ url, auth: new Headers(init.headers).get('Authorization') })
      const r = network(url)
      if (r === 'offline') throw new TypeError('Failed to fetch')
      return r
    }),
  )
})

afterEach(async () => {
  vi.useRealTimers()
  await (backend as unknown as { sb: { auth: { stopAutoRefresh(): Promise<void> } } } | null)?.sb.auth.stopAutoRefresh()
  backend = null
  vi.unstubAllGlobals()
})

const restCalls = () => calls.filter((c) => c.url.includes('/rest/v1/'))

describe('SupabaseBackend with the real client', () => {
  it('sends writes with the user token', async () => {
    storeSession(3600)
    make()
    expect(await codeOf(backend!.put('logs', log))).toBe('ok')
    expect(restCalls().map((c) => c.auth)).toEqual(['Bearer user-jwt'])
  })

  it('keeps a write for later (never sent as anonymous) while an expired token cannot be refreshed offline', async () => {
    // auth-js retries a failed refresh with backoff for up to 30 s before giving up
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    storeSession(-60) // the 1 h token ran out during the workout
    network = (url) => (url.includes('/auth/v1/') ? 'offline' : new Response('{}', { status: 401 }))
    make()
    const first = codeOf(backend!.put('logs', log))
    await vi.advanceTimersByTimeAsync(35_000)
    expect(await first).toBe('network')
    // the signal is back, but auth-js answers from its 60 s refresh-failure cooldown: no session yet
    network = (url) => (url.includes('/auth/v1/') ? 'offline' : new Response('[]', { status: 201 }))
    const second = codeOf(backend!.put('logs', log))
    await vi.advanceTimersByTimeAsync(35_000)
    expect(await second).toBe('network')
    expect(restCalls()).toEqual([])
    expect(calls.some((c) => c.url.includes('/auth/v1/token'))).toBe(true)
  })

  it('reports a session that is gone as such (the store then keeps the write for the next sign-in)', async () => {
    make()
    expect(await codeOf(backend!.put('logs', log))).toBe('auth')
    expect(await codeOf(backend!.loadAll())).toBe('auth')
    expect(restCalls()).toEqual([])
  })
})
