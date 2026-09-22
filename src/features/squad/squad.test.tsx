import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetForTests, getState, setState } from '../../data/store'
import type { Cheer } from '../../data/types'
import { setLang } from '../../i18n'
import { addDays, startOfWeek, todayISO } from '../../lib/dates'
import { at, mkCheer, mkLog, mkMember, MINI } from '../../lib/testing/fixtures'
import { CheerInbox } from './CheerInbox'
import ComparePage from './ComparePage'
import { KudosBar } from './KudosBar'
import MemberPage from './MemberPage'
import { NudgeButton } from './NudgeButton'
import SquadPage from './SquadPage'
import { SquadPulseCard } from './SquadPulseCard'
import { useSummaryText } from './compare/summary'

const today = todayISO()
const monday = startOfWeek(today)
const S = mkMember({ id: 's', slug: 'stelios', name: 'Stelios', programStart: addDays(monday, -7) })
const T = mkMember({ id: 't', slug: 'thanos', name: 'Thanos', color: 'orange', programStart: addDays(monday, -7) })
const D = mkMember({ id: 'd', slug: 'dennis', name: 'Dennis', role: 'coach', competes: false, programId: null, color: 'aqua' })

function seed(meId: string, p: { cheers?: Cheer[]; logs?: ReturnType<typeof mkLog>[] } = {}) {
  setState({
    status: 'ready',
    meId,
    members: { s: S, t: T, d: D },
    programs: { [MINI.id]: MINI },
    logs: Object.fromEntries((p.logs ?? []).map((l) => [l.id, l])),
    cheers: Object.fromEntries((p.cheers ?? []).map((c) => [c.id, c])),
  })
}

const ui = (node: ReactNode, path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/squad" element={node} />
        <Route path="/squad/compare" element={node} />
        <Route path="/member/:slug" element={node} />
        <Route path="*" element={node} />
      </Routes>
    </MemoryRouter>,
  )

const cheers = () => Object.values(getState().cheers)

beforeEach(() => {
  __resetForTests()
  setLang('en')
})
afterEach(cleanup)

describe('KudosBar', () => {
  it('toggles the viewer reaction as a kudos cheer', () => {
    seed('t')
    ui(<KudosBar itemId="workout:x" toId="s" />)
    fireEvent.click(screen.getByRole('button', { name: 'React with 💪' }))
    expect(cheers()).toHaveLength(1)
    expect(cheers()[0]).toMatchObject({ kind: 'kudos', fromId: 't', toId: 's', ref: 'workout:x', emoji: '💪' })
    const mine = screen.getByRole('button', { name: /Remove your 💪/ })
    expect(mine.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(mine)
    expect(cheers()).toHaveLength(0)
  })

  it('shows counts only on your own items', () => {
    seed('s', { cheers: [mkCheer({ fromId: 't', toId: 's', kind: 'kudos', ref: 'workout:x', emoji: '🔥', createdAt: 1 })] })
    ui(<KudosBar itemId="workout:x" toId="s" />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText('Kudos from Thanos')).toBeTruthy()
  })
})

describe('NudgeButton', () => {
  it('sends a preset nudge and then cools down', () => {
    seed('s')
    ui(<NudgeButton member={T} />)
    fireEvent.click(screen.getByRole('button', { name: 'Nudge Thanos' }))
    fireEvent.click(screen.getByRole('button', { name: /Time to train!/ }))
    const sent = cheers().find((c) => c.kind === 'nudge')
    expect(sent).toMatchObject({ fromId: 's', toId: 't', text: 'Time to train!', emoji: '💪', seenAt: null })
    const btn = screen.getByRole('button', { name: /Nudged/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('renders nothing for yourself', () => {
    seed('s')
    const { container } = ui(<NudgeButton member={S} />)
    expect(container.querySelector('button')).toBeNull()
  })
})

describe('CheerInbox', () => {
  const nudge = mkCheer({ id: 'n1', fromId: 't', toId: 's', kind: 'nudge', emoji: '😄', text: 'Bench day', createdAt: Date.now() - 60000 })

  it('is empty without unseen nudges', () => {
    seed('s')
    const { container } = ui(<CheerInbox />)
    expect(container.textContent).toBe('')
  })

  it('cheers back (a 💪 nudge in reply) and marks the nudge seen', () => {
    seed('s', { cheers: [nudge] })
    ui(<CheerInbox />)
    expect(screen.getByText('Bench day 😄')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cheer back' }))
    const reply = cheers().find((c) => c.fromId === 's')
    expect(reply).toMatchObject({ toId: 't', kind: 'nudge', emoji: '💪', ref: 'cheer:n1' })
    expect(getState().cheers.n1.seenAt).not.toBeNull()
  })

  it('dismisses', () => {
    seed('s', { cheers: [nudge] })
    ui(<CheerInbox />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(getState().cheers.n1.seenAt).not.toBeNull()
  })
})

describe('SquadPage', () => {
  const logs = [
    mkLog({ member: 's', week: 1, day: 0, doneAt: at(addDays(monday, -7), 9) }),
    mkLog({ member: 't', week: 2, day: 0, doneAt: at(monday, 20) }),
  ]

  it('shows everyone on the overview and switches tabs', () => {
    seed('s', { logs })
    ui(<SquadPage />, '/squad')
    expect(screen.getByRole('heading', { name: 'Squad' })).toBeTruthy()
    expect(screen.getAllByText('Thanos').length).toBeGreaterThan(0)
    expect(screen.getAllByText('MVP of the week').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'League' }))
    expect(screen.getByText('Standings')).toBeTruthy()
    expect(screen.getByText('How points work')).toBeTruthy()
  })

  it('marks nudges to the viewer as seen when the feed is shown', () => {
    const n = mkCheer({ id: 'n2', fromId: 't', toId: 's', kind: 'nudge', text: 'Go', createdAt: Date.now() - 1000 })
    seed('s', { logs, cheers: [n] })
    ui(<SquadPage />, '/squad?tab=feed')
    expect(getState().cheers.n2.seenAt).not.toBeNull()
    expect(screen.getByText('Go 🔥')).toBeTruthy()
  })

  it('guides an empty squad to the first workout', () => {
    seed('s')
    ui(<SquadPage />, '/squad')
    expect(screen.getByText('Week 1 starts with one workout')).toBeTruthy()
    act(() => setState({ meId: 'd', members: { s: { ...S, programStart: null }, t: T, d: D } }))
    expect(screen.getByText('Set the start dates')).toBeTruthy()
  })
})

describe('ComparePage', () => {
  it('shows the score and the tale of the tape for the viewer and their rival', () => {
    seed('t', { logs: [mkLog({ member: 't', week: 1, day: 0, doneAt: at(addDays(monday, -7), 9) })] })
    ui(<ComparePage />, '/squad/compare')
    const tape = screen.getByRole('region', { name: 'Tale of the tape' })
    expect(within(tape).getByText('Workouts done')).toBeTruthy()
    expect(within(tape).getAllByText('Thanos').length).toBeGreaterThan(0)
    expect(screen.getByText('You lead')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Left corner: Thanos' })).toBeTruthy()
  })

  it('explains when there is nobody to compare with', () => {
    seed('s')
    act(() => setState({ members: { s: S, d: D } }))
    ui(<ComparePage />, '/squad/compare')
    expect(screen.getByText('Head-to-head needs two athletes')).toBeTruthy()
  })
})

describe('MemberPage', () => {
  it('shows a profile with nudge and compare', () => {
    seed('s')
    ui(<MemberPage />, '/member/thanos')
    expect(screen.getByRole('heading', { name: 'Thanos' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nudge Thanos' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Compare/ }).getAttribute('href')).toBe('/squad/compare?a=stelios&b=thanos')
  })

  it('handles an unknown slug', () => {
    seed('s')
    ui(<MemberPage />, '/member/nobody')
    expect(screen.getByText('Member not found')).toBeTruthy()
  })
})

describe('summary line', () => {
  it('reads naturally in both languages', () => {
    const clauses = [
      { kind: 'lifts' as const, who: 'b' as const, region: 'legs' as const },
      { kind: 'consistency' as const, who: 'a' as const },
    ]
    const en = renderHook(() => useSummaryText()).result.current
    expect(en(clauses, S, T, 's')).toBe("Thanos out-lifts you on legs; you're more consistent.")
    expect(en(clauses, S, T, 'd')).toBe('Thanos out-lifts Stelios on legs; Stelios is more consistent.')
    setLang('el')
    const el = renderHook(() => useSummaryText()).result.current
    expect(el(clauses, S, T, 's')).toBe('Thanos σε περνάει στα πόδια, ενώ εσύ είσαι πιο συνεπής.')
  })
})

describe('SquadPulseCard', () => {
  it('links the head-to-head score and lists this week', () => {
    seed('s', { logs: [mkLog({ member: 's', week: 2, day: 0, doneAt: at(monday, 9) })] })
    ui(<SquadPulseCard />)
    expect(screen.getByText('Squad pulse')).toBeTruthy()
    expect(screen.getByRole('link', { name: /You lead Thanos/ }).getAttribute('href')).toBe('/squad/compare?a=stelios&b=thanos')
  })
})
