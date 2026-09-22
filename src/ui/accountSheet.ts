/**
 * Tiny event emitter between PageHeader's avatar button and the AppShell, which owns the account sheet.
 *
 *   // AppShell
 *   useEffect(() => onAccountSheet(() => setAccountOpen(true)), [])
 *   // anywhere
 *   openAccountSheet()
 */
const listeners = new Set<() => void>()

export function openAccountSheet(): void {
  listeners.forEach((cb) => cb())
}

/** Subscribe to open requests. Returns the unsubscribe function. */
export function onAccountSheet(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
