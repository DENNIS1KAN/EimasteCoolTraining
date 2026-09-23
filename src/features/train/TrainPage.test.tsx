import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetForTests, getState, setState } from '../../data/store'
import type { Member, WorkoutLog } from '../../data/types'
import { setLang } from '../../i18n'
import { MINI, at, mkLog, mkMember } from '../../lib/testing/fixtures'
import TrainPage from './TrainPage'
import { TodayWorkoutCard } from './TodayWorkoutCard'
import { getRest, stopRest } from './logic/restTimer'

const ME = 'stelios'
const W2_UPPER = `${ME}__${MINI.id}__w2d0`

function seed(p: { member?: Partial<Member>; logs?: WorkoutLog[] } = {}) {
  const me = mkMember({ id: ME, name: 'Stelios', programId: MINI.id, programStart: '2026-01-05', ...p.member })
  setState({
    status: 'ready',
    meId: ME,
    members: { [ME]: me },
    programs: { [MINI.id]: MINI },
    logs: Object.fromEntries((p.logs ?? []).map((l) => [l.id, l])),
  })
}

const at2 = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/train" element={<TrainPage />} />
        <Route path="/train/:week/:day" element={<TrainPage />} />
        <Route path="/" element={<TodayWorkoutCard />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  __resetForTests()
  setLang('en')
})
afterEach(() => {
  stopRest()
  cleanup()
})

describe('TrainPage', () => {
  const week1 = mkLog({ week: 1, day: 0, doneAt: at('2026-01-05'), ex: { 0: { sets: [['50', '10'], ['50', '9']] }, 1: { sets: [['40', '8'], ['40', '8']] } } })

  it('opens the next workout (the first one not done)', () => {
    seed({ logs: [week1] })
    at2('/train')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Lower day/i)
    // MINI week 1: Upper done -> next is Lower (w1d1)
    expect(screen.getAllByText('Squat').length).toBeGreaterThan(0)
  })

  it('reuses last time on an empty tick, stores the set and starts the rest timer', () => {
    seed({ logs: [week1] })
    at2('/train/2/0')
    const bench = document.getElementById('ex-0')!
    expect(within(bench).getByText('Week 1')).toBeTruthy()
    expect(within(bench).getByLabelText('Set 1 weight in kg').getAttribute('placeholder')).toBe('50')
    act(() => {
      fireEvent.click(within(bench).getByRole('button', { name: 'Mark set 1 done' }))
    })
    const log = getState().logs[W2_UPPER]
    expect(log.ex['0'].sets[0]).toMatchObject({ w: '50', r: '10', ok: true })
    expect(log.unit).toBe('kg')
    expect(log.startedAt).toBeGreaterThan(0)
    expect(getRest()?.next[1]).toMatch(/Set 2/)
    expect(screen.getByRole('timer', { name: /Rest timer/ })).toBeTruthy()
  })

  it('shows weights with the Greek decimal comma but stores them canonical', () => {
    const halves = mkLog({ week: 1, day: 0, doneAt: at('2026-01-05'), ex: { 0: { sets: [['52.5', '10'], ['52.5', '9']] } } })
    seed({ logs: [halves] })
    setLang('el')
    at2('/train/2/0')
    const [w1, , w2] = document.getElementById('ex-0')!.querySelectorAll<HTMLInputElement>('.tr-fld input')
    expect(w1.placeholder).toBe('52,5')
    act(() => {
      fireEvent.change(w2, { target: { value: '55,5' } })
    })
    expect(getState().logs[W2_UPPER].ex['0'].sets[1].w).toBe('55.5')
    expect(w2.value).toBe('55,5')
  })

  it("stops the rest timer when someone else signs in (it never shows another member's rest)", () => {
    seed({ logs: [week1] })
    at2('/train/2/0')
    act(() => {
      fireEvent.click(within(document.getElementById('ex-0')!).getByRole('button', { name: 'Mark set 1 done' }))
    })
    expect(getRest()?.memberId).toBe(ME)
    act(() => {
      setState((s) => ({ meId: 'thanos', members: { ...s.members, thanos: mkMember({ id: 'thanos', name: 'Thanos', programId: MINI.id }) } }))
    })
    expect(getRest()).toBeNull()
    expect(screen.queryByRole('timer', { name: /Rest timer/ })).toBeNull()
  })

  it('focuses the reps input when there is nothing to reuse', () => {
    seed()
    at2('/train/1/0')
    const bench = document.getElementById('ex-0')!
    act(() => {
      fireEvent.click(within(bench).getByRole('button', { name: 'Mark set 1 done' }))
    })
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Set 1 reps')
    expect(getRest()).toBeNull()
  })

  it('finishes the workout from the sheet and shows the completion card', () => {
    seed({ logs: [week1] })
    at2('/train/2/0')
    // Nothing logged yet: no "Finish" in the header, only at the end of the list
    expect(screen.queryByRole('button', { name: 'Finish' })).toBeNull()
    const bench = document.getElementById('ex-0')!
    act(() => {
      fireEvent.click(within(bench).getByRole('button', { name: 'Mark set 1 done' }))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
    })
    act(() => {
      fireEvent.click(screen.getByRole('radio', { name: /Great/ }))
    })
    act(() => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish workout' }))
    })
    const log = getState().logs[W2_UPPER]
    expect(log).toMatchObject({ done: true, feel: 5 })
    expect(screen.getByText('Workout done')).toBeTruthy()
    // the first workout not done is next (catching up on week 1)
    expect(screen.getByRole('link', { name: /Next: Lower · Week 1/ })).toBeTruthy()
  })

  it('fills the grey last-time weight into sets finished with reps only', () => {
    seed({ logs: [week1] })
    at2('/train/2/0')
    const bench = document.getElementById('ex-0')!
    act(() => {
      fireEvent.change(within(bench).getByLabelText('Set 1 reps'), { target: { value: '10' } })
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Finish workout' }))
    })
    // the sheet's preview already counts the volume of 50 kg × 10
    expect(screen.getByText('500 kg')).toBeTruthy()
    act(() => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish workout' }))
    })
    expect(getState().logs[W2_UPPER].ex['0'].sets[0]).toMatchObject({ w: '50', r: '10', ok: false })
  })

  it('asks for a start date when the program has none, and saves it', () => {
    seed({ member: { programStart: null } })
    at2('/train/1/0')
    expect(screen.queryByRole('button', { name: /Finish/ })).toBeNull()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Start the program' }))
    })
    expect(getState().members[ME].programStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('explains when there is no program', () => {
    seed({ member: { programId: null } })
    at2('/train')
    expect(screen.getByText('No program yet')).toBeTruthy()
  })
})

describe('TodayWorkoutCard', () => {
  it('invites to pick a start date before the program starts', () => {
    seed({ member: { programStart: null } })
    at2('/')
    expect(screen.getByRole('button', { name: 'Set start date' })).toBeTruthy()
  })

  it('has a start button to the next workout', () => {
    seed({ member: { programStart: '2020-01-06' } })
    at2('/')
    // long past start and nothing done: behind schedule, start at week 1 day 1
    expect(screen.getByRole('link', { name: /Start workout/ }).getAttribute('href')).toBe('/train/1/0')
    expect(screen.getByText(/workouts behind/)).toBeTruthy()
  })
})
