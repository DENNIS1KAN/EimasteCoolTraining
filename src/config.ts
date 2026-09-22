/**
 * Runtime configuration. Values come from (first match wins):
 *   1. public/config.js  -> window.ECT_CONFIG   (edit on GitHub, no rebuild needed)
 *   2. build-time env     -> VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_AUTH_EMAIL_DOMAIN
 * Without a Supabase URL + anon key the app runs in demo mode (data stays in the browser).
 */
export interface AppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  /** Logins use `<slug>@<domain>` behind the scenes; people only ever type a password. */
  authEmailDomain: string
}

declare global {
  interface Window {
    ECT_CONFIG?: Partial<AppConfig>
  }
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function readConfig(): AppConfig {
  const w = (typeof window !== 'undefined' && window.ECT_CONFIG) || {}
  const env = import.meta.env
  return {
    supabaseUrl: clean(w.supabaseUrl) || clean(env.VITE_SUPABASE_URL),
    supabaseAnonKey: clean(w.supabaseAnonKey) || clean(env.VITE_SUPABASE_ANON_KEY),
    authEmailDomain: clean(w.authEmailDomain) || clean(env.VITE_AUTH_EMAIL_DOMAIN) || 'eimastecool.app',
  }
}

export const isSupabaseConfigured = (c: AppConfig): boolean => /^https?:\/\//.test(c.supabaseUrl) && c.supabaseAnonKey.length > 20
