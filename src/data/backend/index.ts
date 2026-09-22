import type { AppConfig } from '../../config'
import { configProblem, isSupabaseConfigured } from '../../config'
import type { ChangeEvent, FileRef, LoginProfile, Snapshot } from '../types'
import type { Backend } from './types'
import { BackendError } from './types'

/**
 * Stands in for Supabase when the configuration must not be used (e.g. the secret key in config.js): every call
 * fails with the explanation, so the app shows it on its error screen and never sends that key anywhere.
 */
export class MisconfiguredBackend implements Backend {
  readonly kind = 'supabase' as const
  constructor(private readonly problem: string) {}
  private async fail(): Promise<never> {
    throw new BackendError('config', this.problem)
  }
  init = (): Promise<string | null> => this.fail()
  loginProfiles = (): Promise<LoginProfile[]> => this.fail()
  signIn = (): Promise<string> => this.fail()
  join = (): Promise<string> => this.fail()
  signOut = (): Promise<void> => Promise.resolve()
  changePassword = (): Promise<void> => this.fail()
  onSignedOut = (): (() => void) => () => {}
  loadAll = (): Promise<Snapshot> => this.fail()
  put = (): Promise<void> => this.fail()
  remove = (): Promise<void> => this.fail()
  subscribe = (_cb: (e: ChangeEvent) => void): (() => void) => () => {}
  uploadFile = (): Promise<FileRef> => this.fail()
  fileUrl = (): Promise<string> => this.fail()
  deleteFile = (): Promise<void> => this.fail()
  invites = (): Promise<Record<string, string>> => this.fail()
  resetInvite = (): Promise<string> => this.fail()
  createMember = (): Promise<string> => this.fail()
}

/** Pick the backend for this deployment. The Supabase client is loaded lazily so demo mode stays light. */
export async function createBackend(config: AppConfig): Promise<{ backend: Backend; namespace: string }> {
  if (isSupabaseConfigured(config)) {
    const host = config.supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]
    const problem = configProblem(config)
    if (problem) return { backend: new MisconfiguredBackend(problem), namespace: `sb-${host}` }
    const { SupabaseBackend } = await import('./supabase')
    return { backend: new SupabaseBackend(config), namespace: `sb-${host}` }
  }
  const { LocalBackend } = await import('./local')
  return { backend: new LocalBackend(), namespace: 'demo' }
}
