import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetForTests, getState, setState } from '../../data/store'
import type { Member, WeightVisibility } from '../../data/types'
import { setLang } from '../../i18n'
import { addDays, todayISO } from '../../lib/dates'
import { mkMember, mkWeight } from '../../lib/testing/fixtures'
import BodyPage from './BodyPage'
import { WeightMiniCard } from './WeightMiniCard'
import { WeightEntrySheet } from './WeightEntrySheet'
import { WeightTrendChart } from './WeightTrendChart'

const today = todayISO()
const vis = (v: WeightVisibility) => ({ unit: 'kg' as const, machines: {}, weightVisibility: v })

function seed(members: Member[], meId: string, weights = [] as ReturnType<typeof mkWeight>[]) {
  setState({
    status: 'ready',
    meId,
    members: Object.fromEntries(members.map((m) => [m.id, m])),
    weights: Object.fromEntries(weights.map((w) => [w.id, w])),
  })
}

/** 20 daily weigh-ins ending yesterday, from 84 down 0.1 a day. */
const history = (id: string) => Array.from({ length: 20 }, (_, i) => mkWeight(id, addDays(today, i - 20), 84 - i * 0.1))

const ui = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>)

beforeEach(() => {
  __resetForTests()
  setLang('en')
})
afterEach(cleanup)

describe('WeightMiniCard', () => {
  const me = mkMember({ id: 'me', name: 'Stelios', goalWeightKg: 79 })
  const coach = mkMember({ id: 'coach', name: 'Dennis', role: 'coach', competes: false })

  it('shows the viewer their trend weight and links to /body', () => {
    seed([me], 'me', history('me'))
    ui(<WeightMiniCard memberId="me" />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/body')
    expect(link.textContent).toMatch(/kg/)
  })

  it('hides a private member from friends but not from the coach', () => {
    const priv = mkMember({ id: 'p', name: 'Thanos', settings: vis('private') })
    seed([me, priv, coach], 'me', history('p'))
    ui(<WeightMiniCard memberId="p" />)
    expect(screen.getByText('Private')).toBeTruthy()
    cleanup()
    act(() => setState({ meId: 'coach' }))
    ui(<WeightMiniCard memberId="p" />)
    expect(screen.queryByText('Private')).toBeNull()
  })

  it('shows only the signed change for change-only members', () => {
    const ch = mkMember({ id: 'c', name: 'Thanos', settings: vis('change') })
    seed([me, ch], 'me', history('c'))
    const { container } = ui(<WeightMiniCard memberId="c" />)
    const big = container.querySelector('.body-mini__value')!.textContent!
    expect(big.startsWith('−')).toBe(true)
    expect(container.textContent).not.toMatch(/8\d\.\d/)
  })

  it('invites the viewer to log when empty', () => {
    seed([me], 'me')
    ui(<WeightMiniCard memberId="me" />)
    expect(screen.getByText('Tap to log')).toBeTruthy()
  })
})

describe('WeightTrendChart', () => {
  it('shows a lock for a private member', () => {
    const me = mkMember({ id: 'me' })
    const priv = mkMember({ id: 'p', settings: vis('private') })
    seed([me, priv], 'me', history('p'))
    ui(<WeightTrendChart memberId="p" />)
    expect(screen.getByText('Weight is private')).toBeTruthy()
  })

  it('draws change from start for change-only members', () => {
    const me = mkMember({ id: 'me' })
    const ch = mkMember({ id: 'c', name: 'Thanos', settings: vis('change') })
    seed([me, ch], 'me', history('c'))
    ui(<WeightTrendChart memberId="c" days={30} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/change since start, last 30 days: −1\.\d kg/)
  })
})

describe('BodyPage', () => {
  it('guides a brand-new member and logs the first weigh-in from the dock', () => {
    seed([mkMember({ id: 'me', name: 'Stelios' })], 'me')
    ui(<BodyPage />)
    expect(screen.getByText('Step on the scale')).toBeTruthy()
    expect(screen.getByText('Set a goal weight')).toBeTruthy()
    expect(screen.getByText('How to weigh in')).toBeTruthy()
    const dock = screen.getByRole('region', { name: 'Log today' })
    act(() => {
      fireEvent.click(within(dock).getByRole('button', { name: 'Save weight' }))
    })
    const row = getState().weights[`me__${today}`]
    expect(row.kg).toBe(75)
    expect(screen.getByText('Logged 75.0 kg today')).toBeTruthy()
  })

  it('shows the trend hero, goal progress and a history that opens the edit sheet', () => {
    seed([mkMember({ id: 'me', name: 'Stelios', goalWeightKg: 80, programStart: addDays(today, -20) })], 'me', [
      ...history('me'),
      mkWeight('me', today, 82),
    ])
    ui(<BodyPage />)
    expect(screen.getByText(/Stelios · Cut phase/i)).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: /Progress to goal/ })).toBeTruthy()
    const rows = screen.getAllByRole('button', { name: /kg/ }).filter((b) => b.classList.contains('body-history__row'))
    expect(rows).toHaveLength(10)
    fireEvent.click(screen.getByRole('button', { name: 'Show all (21)' }))
    act(() => {
      fireEvent.click(screen.getAllByRole('button').filter((b) => b.classList.contains('body-history__row'))[1])
    })
    const dialog = screen.getByRole('dialog', { name: 'Edit weigh-in' })
    expect(within(dialog).getByText('Yesterday')).toBeTruthy()
    // editing yesterday's entry is not a clash with today's
    expect(within(dialog).queryByText(/already logged/)).toBeNull()
  })
})

describe('WeightEntrySheet', () => {
  it('keeps an out-of-range body fat or waist from being saved', () => {
    seed([mkMember({ id: 'me', name: 'Stelios' })], 'me', history('me'))
    ui(<WeightEntrySheet open onClose={() => {}} memberId="me" unit="kg" startValue={82} />)
    const dialog = screen.getByRole('dialog', { name: 'Log weight' })
    const save = within(dialog).getByRole('button', { name: 'Save weight' }) as HTMLButtonElement
    const fat = within(dialog).getByLabelText('Body fat')
    const waist = within(dialog).getByLabelText('Waist')
    fireEvent.change(fat, { target: { value: '1' } })
    expect(save.disabled).toBe(true)
    // Enter in the field: nothing is saved and the allowed range shows at once
    fireEvent.submit(fat.closest('form')!)
    expect(getState().weights[`me__${today}`]).toBeUndefined()
    expect(within(dialog).getByText('Enter a number from 2 to 70')).toBeTruthy()
    fireEvent.change(fat, { target: { value: '18,5' } })
    fireEvent.change(waist, { target: { value: '850' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(waist, { target: { value: '85' } })
    expect(save.disabled).toBe(false)
    act(() => {
      fireEvent.click(save)
    })
    expect(getState().weights[`me__${today}`]).toMatchObject({ kg: 82, bodyFat: 18.5, waistCm: 85 })
  })
})
