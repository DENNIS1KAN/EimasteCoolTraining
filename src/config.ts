/**
 * Runtime configuration. Values come from (first match wins):
 *   1. public/config.js  -> window.ECT_CONFIG   (edit on GitHub, no rebuild needed)
 *   2. build-time env     -> VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_AUTH_EMAIL_DOMAIN
 * Without a Supabase URL + anon key the app runs in demo mode (data stays in the browser).
 */
export interface AppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  /**
   * New logins are `<slug>-<invite>@<domain>` behind the scenes; people only ever type a password. Existing
   * logins keep the address they joined with, so changing this never locks anyone out.
   */
  authEmailDomain: string
}

declare global {
  interface Window {
    ECT_CONFIG?: Partial<AppConfig>
  }
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Only for local development: on a real site the site's own address is used (see siteEmailDomain). */
export const FALLBACK_EMAIL_DOMAIN = 'eimastecool.app'

/**
 * The site's host name when it can serve as the login e-mail domain: a public name that belongs to whoever runs
 * the site (e.g. dennis1kan.github.io), so nobody else can register it and receive mail for the squad's logins.
 * Null for localhost, IP addresses and private names.
 */
export function siteEmailDomain(hostname: string): string | null {
  const h = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)) return null // also rejects IPv6 and bare names like "localhost"
  if (/^[\d.]+$/.test(h)) return null // IPv4
  if (/(^|\.)(localhost|local|localdomain|internal|lan|home|test|example|invalid)$/.test(h)) return null
  return h
}

export function readConfig(): AppConfig {
  const w = (typeof window !== 'undefined' && window.ECT_CONFIG) || {}
  const env = import.meta.env
  const host = typeof location !== 'undefined' ? location.hostname : ''
  return {
    supabaseUrl: clean(w.supabaseUrl) || clean(env.VITE_SUPABASE_URL),
    supabaseAnonKey: clean(w.supabaseAnonKey) || clean(env.VITE_SUPABASE_ANON_KEY),
    authEmailDomain: clean(w.authEmailDomain) || clean(env.VITE_AUTH_EMAIL_DOMAIN) || siteEmailDomain(host) || FALLBACK_EMAIL_DOMAIN,
  }
}

export const isSupabaseConfigured = (c: AppConfig): boolean => /^https?:\/\//.test(c.supabaseUrl) && c.supabaseAnonKey.length > 20

/** The `role` claim of a legacy Supabase key (a JWT), or null. */
function jwtRole(key: string): string | null {
  const parts = key.split('.')
  if (parts.length !== 3) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload: unknown = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')))
    const role = typeof payload === 'object' && payload ? (payload as { role?: unknown }).role : null
    return typeof role === 'string' ? role : null
  } catch {
    return null
  }
}

/**
 * Why the app must not start with this configuration, or null. config.js is public: the secret key
 * (service_role / sb_secret_...) would let every visitor bypass all the database's security rules.
 */
export function configProblem(c: AppConfig): string | null {
  const key = c.supabaseAnonKey
  if (/^sb_secret_/i.test(key) || jwtRole(key) === 'service_role') {
    return (
      'config.js contains the SECRET key (service_role). Anyone could read it and bypass all security. ' +
      'Replace it with the anon / publishable key (Supabase → Project Settings → API), then roll the secret key there.'
    )
  }
  return null
}
