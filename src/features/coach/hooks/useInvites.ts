import { useCallback, useEffect, useState } from 'react'
import { getBackend } from '../../../data/store'

export interface InvitesState {
  /** Invite codes by member id (null until the first load finishes). */
  codes: Record<string, string> | null
  loading: boolean
  error: string | null
  reload: () => void
  /** Record a code we just received (new member, reset login) without refetching. */
  setCode: (memberId: string, code: string) => void
}

// Last known codes, so switching tabs or pages shows links instantly while they revalidate.
let cache: Record<string, string> | null = null

/** The coach's invite codes, loaded on mount (coach-only backend call; errors are surfaced, not thrown). */
export function useInvites(): InvitesState {
  const [codes, setCodes] = useState<Record<string, string> | null>(cache)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getBackend()
      .invites()
      .then((c) => {
        if (!alive) return
        cache = c
        setCodes(c)
        setError(null)
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const setCode = useCallback((memberId: string, code: string) => {
    setCodes((c) => {
      const next = { ...(c ?? {}), [memberId]: code }
      cache = next
      return next
    })
  }, [])

  return { codes, loading, error, reload, setCode }
}
