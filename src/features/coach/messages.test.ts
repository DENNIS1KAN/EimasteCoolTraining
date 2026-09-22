import { describe, expect, it } from 'vitest'
import { M } from './messages'

describe('coach messages', () => {
  it('has a Greek string for every English one, using only placeholders the English one has', () => {
    const vars = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))]
    for (const k of Object.keys(M.en) as (keyof typeof M.en)[]) {
      expect(M.el[k], k).toBeTruthy()
      const en = vars(M.en[k])
      // Greek may leave a name out where it would need the vocative case (the invite message)
      expect(vars(M.el[k]).filter((v) => !en.includes(v)), k).toEqual([])
      if (k !== 'shareText') expect(vars(M.el[k]).sort(), k).toEqual(en.sort())
    }
    expect(Object.keys(M.el).sort()).toEqual(Object.keys(M.en).sort())
  })
})
