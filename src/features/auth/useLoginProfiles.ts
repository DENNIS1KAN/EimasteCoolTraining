import { useCallback, useEffect, useState } from 'react'
import { getBackend } from '../../data/store'
import type { LoginProfile } from '../../data/types'

export type ProfilesState =
  | { status: 'loading'; profiles: LoginProfile[] }
  | { status: 'ready'; profiles: LoginProfile[] }
  | { status: 'error'; profiles: LoginProfile[]; error: unknown }

const ROLE_ORDER = { athlete: 0, coach: 1 } as const

/** Athletes first (by name), then the coach, like everywhere else in the app. */
export function sortProfiles(ps: LoginProfile[]): LoginProfile[] {
  return [...ps].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name))
}

/** The squad as the signed-out screens may see it, with a retry. */
export function useLoginProfiles(): ProfilesState & { retry: () => void } {
  const [state, setState] = useState<ProfilesState>({ status: 'loading', profiles: [] })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    getBackend()
      .loginProfiles()
      .then((ps) => alive && setState({ status: 'ready', profiles: sortProfiles(ps) }))
      .catch((error: unknown) => alive && setState((s) => ({ status: 'error', profiles: s.profiles, error })))
    return () => {
      alive = false
    }
  }, [attempt])
  const retry = useCallback(() => {
    setState((s) => ({ status: 'loading', profiles: s.profiles }))
    setAttempt((n) => n + 1)
  }, [])
  return { ...state, retry }
}
