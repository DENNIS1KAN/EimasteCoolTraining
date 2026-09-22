import type { Member, Snapshot } from '../types'
import type { ISODate } from '../../lib/dates'
import { addDays, startOfWeek } from '../../lib/dates'
import { DEFAULT_PROGRAM_ID } from '../programs'

export const DEMO_IDS = { dennis: 'demo-dennis', stelios: 'demo-stelios', thanos: 'demo-thanos' } as const

function member(p: Partial<Member> & Pick<Member, 'id' | 'slug' | 'name' | 'role' | 'color'>): Member {
  return {
    competes: p.role === 'athlete',
    goal: '',
    goalWeightKg: null,
    heightCm: null,
    programId: DEFAULT_PROGRAM_ID,
    programStart: null,
    coachNote: '',
    coachNoteAt: null,
    settings: { unit: 'kg', machines: {}, weightVisibility: 'change' },
    joined: true,
    updatedAt: 1,
    ...p,
  }
}

/**
 * Demo data relative to `today`, so the demo always looks current.
 * (Rich history is generated in seedHistory; see below.)
 */
export function createDemoSnapshot(today: ISODate): Snapshot {
  const start = addDays(startOfWeek(today), -14) // program started on the Monday two weeks ago
  const members: Member[] = [
    member({ id: DEMO_IDS.dennis, slug: 'dennis', name: 'Dennis', role: 'coach', color: 'aqua', competes: false }),
    member({ id: DEMO_IDS.stelios, slug: 'stelios', name: 'Stelios', role: 'athlete', color: 'blue', programStart: start }),
    member({ id: DEMO_IDS.thanos, slug: 'thanos', name: 'Thanos', role: 'athlete', color: 'orange', programStart: start }),
  ]
  return { members, programs: [], logs: [], weights: [], mealPlans: [], checkins: [], cheers: [] }
}
