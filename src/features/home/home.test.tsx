import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetForTests, getState, setState } from '../../data/store'
import { BTS_PROGRAM } from '../../data/programs'
import type { Cheer, Member } from '../../data/types'

import { addDays, todayISO } from '../../lib/dates'
import { mkCheckin, mkMember, mkPlan, mkWeight } from '../../lib/testing/fixtures'
import { setPref } from '../../lib/prefs'
import HomePage from './HomePage'

const today = todayISO()
const athlete = (id: string, p: Partial<Member> = {}) => mkMember({ id, name: id[0].toUpperCase() + id.slice(1), programId: BTS_PROGRAM.id, ...p })
const coach = mkMember({ id: 'dennis', name: 'Dennis', role: 'coach', competes: false, programId: null, color: 'aqua' })

function seed(members: Member[], meId: string, extra: Partial<Parameters<typeof setState>[0] & object> = {}) {
  setState({ status: 'ready', meId, members: Object.fromEntries(members.map((m) => [m.id, m])), ...extra })
}
const ui = () => render(<MemoryRouter>{<HomePage />}</MemoryRouter>)

beforeEach(() => {
  __resetForTests()
  setPref('dismissed', {})
})
afterEach(cleanup)

describe('HomePage (athlete)', () => {
  it('guides a fresh account with the checklist, and the tiles read "not yet"', () => {
    seed([athlete('stelios'), coach], 'stelios')
    ui()
    const list = screen.getByRole('region', { name: 'Three steps to week 1' })
    expect(within(list).getByText('0 of 3 done')).toBeTruthy()
    expect(within(list).getByText('Set your start date')).toBeTruthy()
    // no meal plan yet: the last step waits on the coach, by name
    expect(within(list).getByText('Dennis hasn’t uploaded it yet')).toBeTruthy()
    // the tiles keep their shape rather than vanishing, so the layout never reflows once training starts
    const tiles = screen.getByRole('list', { name: 'Your numbers' })
    expect(within(tiles).getByText('Week streak')).toBeTruthy()
    expect(within(tiles).getAllByText('not yet').length).toBe(3)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/, Stelios$/)
  })

  it('hides the checklist when dismissed', () => {
    seed([athlete('stelios'), coach], 'stelios')
    ui()
    fireEvent.click(screen.getByRole('button', { name: 'Hide the checklist' }))
    expect(screen.queryByText('Three steps to week 1')).toBeNull()
    expect(getState().meId).toBe('stelios')
  })

  it('shows the week in the eyebrow, the tiles and the unseen cheers on the bell', () => {
    const start = addDays(today, -15)
    const me = athlete('stelios', { programStart: start })
    const nudge: Cheer = {
      id: 'c1',
      fromId: 'thanos',
      toId: 'stelios',
      kind: 'nudge',
      ref: null,
      emoji: '💪',
      text: 'Move it',
      createdAt: Date.now(),
      seenAt: null,
      updatedAt: Date.now(),
    }
    seed([me, athlete('thanos', { programStart: start }), coach], 'stelios', {
      weights: Object.fromEntries([mkWeight('stelios', addDays(today, -1), 82)].map((w) => [w.id, w])),
      cheers: { c1: nudge },
      mealPlans: { p1: mkPlan({ id: 'p1', memberId: 'stelios', startDate: start, active: true }) },
      checkins: Object.fromEntries([mkCheckin('stelios', addDays(today, -1), { rating: 'on' })].map((c) => [c.id, c])),
    })
    ui()
    expect(screen.getByText(/Week 3 of 12/)).toBeTruthy()
    expect(screen.getByText('Week streak')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeTruthy()
    // everything was already in place the first time: no checklist, not even the "all set" card
    expect(screen.queryByText('Three steps to week 1')).toBeNull()
  })
})

describe('HomePage (coach)', () => {
  it('shows the squad today with a nudge for whoever is behind', () => {
    const start = addDays(today, -15)
    seed([athlete('stelios', { programStart: start }), athlete('thanos', { programStart: start }), coach], 'dennis')
    ui()
    const card = screen.getByRole('region', { name: 'Squad today' })
    expect(within(card).getByText('Stelios')).toBeTruthy()
    expect(within(card).getByText('Thanos')).toBeTruthy()
    // nobody trained in two weeks: both are behind and get a nudge button
    expect(within(card).getAllByRole('button', { name: /^Nudge/ }).length).toBe(2)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/, Dennis$/)
  })

  it('walks a new coach through the set-up', () => {
    seed([athlete('stelios', { joined: false }), athlete('thanos'), coach], 'dennis')
    ui()
    const setup = screen.getByRole('region', { name: 'Get everyone to day 1' })
    expect(within(setup).getByText('1 of 2 have joined')).toBeTruthy()
    expect(within(setup).getByText('0 of 2 ready')).toBeTruthy()
  })

  it('a coach who competes (the default) gets the athlete home, plus the set-up and the squad', () => {
    const start = addDays(today, -15)
    const playing = { ...coach, competes: true, programId: BTS_PROGRAM.id, programStart: start }
    seed([athlete('stelios', { programStart: start, joined: false }), athlete('thanos', { programStart: start }), playing], 'dennis')
    ui()
    expect(screen.getByText(/Week 3 of 12/)).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Get everyone to day 1' })).toBeTruthy()
    const card = screen.getByRole('region', { name: 'Squad today' })
    expect(within(card).getByText('Stelios')).toBeTruthy()
    expect(within(card).queryByText('Dennis')).toBeNull()
  })
})
