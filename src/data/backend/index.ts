import type { AppConfig } from '../../config'
import { isSupabaseConfigured } from '../../config'
import type { Backend } from './types'

/** Pick the backend for this deployment. The Supabase client is loaded lazily so demo mode stays light. */
export async function createBackend(config: AppConfig): Promise<{ backend: Backend; namespace: string }> {
  if (isSupabaseConfigured(config)) {
    const { SupabaseBackend } = await import('./supabase')
    const host = config.supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]
    return { backend: new SupabaseBackend(config), namespace: `sb-${host}` }
  }
  const { LocalBackend } = await import('./local')
  return { backend: new LocalBackend(), namespace: 'demo' }
}
