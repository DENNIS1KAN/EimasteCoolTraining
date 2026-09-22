import { afterEach, describe, expect, it } from 'vitest'
import { FALLBACK_EMAIL_DOMAIN, configProblem, readConfig, siteEmailDomain } from './config'
import { createBackend } from './data/backend'
import { BackendError } from './data/backend/types'

const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (role: string) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ iss: 'supabase', ref: 'abcd', role, iat: 1, exp: 2 })}.sig`
const cfg = (supabaseAnonKey: string) => ({ supabaseUrl: 'https://abcd.supabase.co', supabaseAnonKey, authEmailDomain: 'x.example.org' })

afterEach(() => {
  delete window.ECT_CONFIG
})

describe('siteEmailDomain', () => {
  it('uses a public site address', () => {
    expect(siteEmailDomain('dennis1kan.github.io')).toBe('dennis1kan.github.io')
    expect(siteEmailDomain('Train.Example-Squad.com.')).toBe('train.example-squad.com')
  })

  it('refuses local and private names and IP addresses', () => {
    for (const h of ['localhost', '', '127.0.0.1', '192.168.1.20', '[::1]', 'my-mac.local', 'box.lan', 'app.localhost', 'intranet']) {
      expect(siteEmailDomain(h)).toBeNull()
    }
  })
})

describe('readConfig', () => {
  it('defaults the login domain to the site address, with a fallback for local development', () => {
    window.ECT_CONFIG = { supabaseUrl: '', supabaseAnonKey: '', authEmailDomain: '' }
    expect(readConfig().authEmailDomain).toBe(siteEmailDomain(location.hostname) ?? FALLBACK_EMAIL_DOMAIN)
    window.ECT_CONFIG = { authEmailDomain: ' squad.example.org ' }
    expect(readConfig().authEmailDomain).toBe('squad.example.org')
  })
})

describe('configProblem', () => {
  it('refuses the secret key in both formats', () => {
    expect(configProblem(cfg(jwt('service_role')))).toMatch(/SECRET key/)
    expect(configProblem(cfg('sb_secret_abcdefghijklmnopqrstuvwxyz'))).toMatch(/SECRET key/)
  })

  it('accepts the public keys', () => {
    expect(configProblem(cfg(jwt('anon')))).toBeNull()
    expect(configProblem(cfg('sb_publishable_abcdefghijklmnopqrstuvwxyz'))).toBeNull()
    expect(configProblem(cfg('not.a-jwt.at-all-but-long-enough'))).toBeNull()
  })

  it('makes the app stop on its error screen instead of using the secret key', async () => {
    const { backend } = await createBackend(cfg(jwt('service_role')))
    const e = await backend.init().catch((x: unknown) => x)
    expect(e).toBeInstanceOf(BackendError)
    expect(e).toMatchObject({ code: 'config' })
  })
})
