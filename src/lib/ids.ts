/** Deterministic ids keep upserts idempotent across devices. */
export const logId = (memberId: string, programId: string, week: number, day: number): string =>
  `${memberId}__${programId}__w${week}d${day}`

export const dailyId = (memberId: string, date: string): string => `${memberId}__${date}`

/** RFC 4122 v4 uuid (crypto.randomUUID when available). */
export function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
