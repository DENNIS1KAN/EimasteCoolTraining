import { afterEach, describe, expect, it, vi } from 'vitest'
import { dailyId, logId, uuid } from './ids'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('deterministic ids', () => {
  it('logId encodes member, program, week and day', () => {
    expect(logId('stelios', 'bts-12', 3, 0)).toBe('stelios__bts-12__w3d0')
    expect(logId('m', 'p', 12, 4)).not.toBe(logId('m', 'p', 1, 24))
  })

  it('dailyId is one per member per date', () => {
    expect(dailyId('thanos', '2026-09-22')).toBe('thanos__2026-09-22')
  })
})

describe('uuid', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns distinct RFC 4122 v4 ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => uuid()))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(V4)
  })

  it('falls back to getRandomValues when randomUUID is missing', () => {
    const getRandomValues = vi.fn((b: Uint8Array) => b.fill(0xff))
    vi.stubGlobal('crypto', { getRandomValues })
    const id = uuid()
    expect(getRandomValues).toHaveBeenCalledOnce()
    expect(id).toMatch(V4)
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
  })

  it('falls back to Math.random without any crypto', () => {
    vi.stubGlobal('crypto', undefined)
    const a = uuid()
    const b = uuid()
    expect(a).toMatch(V4)
    expect(b).toMatch(V4)
    expect(a).not.toBe(b)
  })
})
