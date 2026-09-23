import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetForTests, setState } from '../../data/store'
import type { Program } from '../../data/types'
import { setLang } from '../../i18n'
import { MINI, at, mkLog, mkMember } from '../../lib/testing/fixtures'
import MemberWorkoutPage from '../squad/MemberWorkoutPage'

/** The member has moved on to NEXT; their week-1 Upper day was logged in MINI. */
const NEXT: Program = { ...MINI, id: 'next', name: 'Next' }
const OLD_LOG = mkLog({ week: 1, day: 0, doneAt: at('2026-01-05'), ex: { 0: { sets: [['52.5', '10']] } } })

function seed() {
  const me = mkMember({ id: 'stelios', name: 'Stelios', programId: NEXT.id, programStart: '2026-03-02' })
  setState({ status: 'ready', meId: me.id, members: { [me.id]: me }, programs: { [MINI.id]: MINI, [NEXT.id]: NEXT }, logs: { [OLD_LOG.id]: OLD_LOG } })
}

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/member/:slug/workout/:week/:day" element={<MemberWorkoutPage />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  __resetForTests()
  setLang('en')
  seed()
})
afterEach(cleanup)

describe('MemberWorkoutPage', () => {
  it('shows the program named by ?program= (an older one), view-only', () => {
    open(`/member/stelios/workout/1/0?program=${MINI.id}`)
    expect(screen.queryByText('Not logged yet')).toBeNull()
    expect(screen.getAllByText('Bench Press').length).toBeGreaterThan(0)
    // Train logs the current program only: no "Open in the logger" for an older program's workout.
    expect(screen.queryByRole('link', { name: /Open in the logger/ })).toBeNull()
  })

  it("falls back to the member's current program without (or with an unknown) ?program=", () => {
    open('/member/stelios/workout/1/0')
    expect(screen.getByText('Not logged yet')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Open in the logger/ })).toBeTruthy()
    cleanup()
    open('/member/stelios/workout/1/0?program=gone')
    expect(screen.getByText('Not logged yet')).toBeTruthy()
  })
})
