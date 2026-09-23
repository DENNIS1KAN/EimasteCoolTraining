import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_IDS } from '../demo/seed'
import { LocalBackend } from './local'

beforeEach(() => localStorage.clear())

describe('LocalBackend.reset', () => {
  it('"Start empty" keeps the people but gives them the profile of a new member', async () => {
    const b = new LocalBackend()
    const seeded = await b.loadAll()
    expect(seeded.logs.length).toBeGreaterThan(0)
    expect(seeded.members.find((m) => m.id === DEMO_IDS.stelios)?.goal).not.toBe('')

    b.reset(false)
    const snap = await b.loadAll()
    for (const t of ['logs', 'weights', 'mealPlans', 'checkins', 'cheers', 'programs'] as const) expect(snap[t]).toEqual([])
    expect(snap.members.map((m) => m.name).sort()).toEqual(seeded.members.map((m) => m.name).sort())
    for (const m of snap.members) {
      const before = seeded.members.find((x) => x.id === m.id)!
      expect(m).toMatchObject({ name: before.name, color: before.color, role: before.role, competes: before.competes, slug: before.slug })
      expect(m).toMatchObject({ goal: '', goalWeightKg: null, heightCm: null, programStart: null, coachNote: '', coachNoteAt: null })
      expect(m.settings).toEqual({ unit: 'kg', machines: {}, weightVisibility: 'exact' })
    }
  })

  it('brings the demo data back', async () => {
    const b = new LocalBackend()
    b.reset(false)
    b.reset(true)
    expect((await b.loadAll()).logs.length).toBeGreaterThan(0)
  })
})
