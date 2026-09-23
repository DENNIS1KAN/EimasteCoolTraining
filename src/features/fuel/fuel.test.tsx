import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetForTests, getState, setState } from '../../data/store'
import type { MealPlan, Member, NutritionCheckin } from '../../data/types'

import { addDays, todayISO } from '../../lib/dates'
import { dailyId } from '../../lib/ids'
import { mkCheckin, mkMember, mkPlan } from '../../lib/testing/fixtures'
import CoachNutritionTab from './CoachNutritionTab'
import FuelPage from './FuelPage'
import MealPlanEditorPage from './MealPlanEditorPage'
import { TodayNutritionCard } from './TodayNutritionCard'

const today = todayISO()
const coach = mkMember({ id: 'dennis', slug: 'dennis', name: 'Dennis', role: 'coach', competes: false })
const stelios = mkMember({ id: 'stelios', slug: 'stelios', name: 'Stelios' })
const thanos = mkMember({ id: 'thanos', slug: 'thanos', name: 'Thanos' })

const meal = (id: string, name: string, kcal: number, protein: number) => ({ id, name, time: '', items: `${name} food`, kcal, protein })
const cut = mkPlan({
  id: 'cut',
  memberId: 'stelios',
  startDate: addDays(today, -10),
  title: 'Cut phase · v2',
  notes: '# Rules\n- No soda',
  kcal: 2000,
  protein: 150,
  carbs: 200,
  fat: 60,
  active: true,
  meals: [meal('b', 'Breakfast', 500, 40), meal('l', 'Lunch', 800, 60), meal('d', 'Dinner', 700, 50)],
})
const oldCut = mkPlan({ id: 'old', memberId: 'stelios', startDate: addDays(today, -40), title: 'Cut phase · v1', active: false })

function seed(p: { members?: Member[]; meId?: string; plans?: MealPlan[]; checkins?: NutritionCheckin[] } = {}) {
  setState({
    status: 'ready',
    meId: p.meId ?? 'stelios',
    members: Object.fromEntries((p.members ?? [coach, stelios, thanos]).map((m) => [m.id, m])),
    mealPlans: Object.fromEntries((p.plans ?? []).map((x) => [x.id, x])),
    checkins: Object.fromEntries((p.checkins ?? []).map((x) => [x.id, x])),
  })
}
const ui = (node: ReactNode, path = '/') => render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>)
const todayRow = (memberId = 'stelios') => getState().checkins[dailyId(memberId, today)]

beforeEach(() => {
  __resetForTests()
})
afterEach(cleanup)

describe('FuelPage', () => {
  it('shows the active plan and ticks meals into today’s check-in', () => {
    seed({ plans: [cut, oldCut] })
    ui(<FuelPage />)
    expect(screen.getByRole('heading', { name: 'Cut phase · v2' })).toBeTruthy()
    expect(screen.getByText('From Coach Dennis', { exact: false })).toBeTruthy()
    const lunch = screen.getByRole('checkbox', { name: 'Lunch' })
    fireEvent.click(lunch)
    expect(todayRow()?.meals).toEqual(['l'])
    expect(todayRow()?.planId).toBe('cut')
    expect(screen.getByRole('checkbox', { name: 'Lunch' }).getAttribute('aria-checked')).toBe('true')
    // kcal ring: 800 of 2,000 eaten
    expect(screen.getByRole('img', { name: /800 of 2,000 kcal eaten, 1,200 left/ })).toBeTruthy()
    // unticking the only thing in the row deletes it again
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lunch' }))
    expect(todayRow()).toBeUndefined()
  })

  it('rates the day, and toggling the rating off drops the empty row', () => {
    seed({ plans: [cut] })
    ui(<FuelPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Mostly' }))
    expect(todayRow()?.rating).toBe('mostly')
    fireEvent.click(screen.getByRole('button', { name: 'Mostly' }))
    // nothing meaningful is left (no meals, no rating, no note), so the row is deleted rather than stored empty
    expect(todayRow()).toBeUndefined()
  })

  it('fills in an earlier day from the day strip', () => {
    seed({ plans: [cut] })
    ui(<FuelPage />)
    const days = within(screen.getByRole('group', { name: 'Pick a day to fill in' })).getAllByRole('button')
    expect(days).toHaveLength(7)
    fireEvent.click(days[5])
    fireEvent.click(screen.getByRole('checkbox', { name: 'Breakfast' }))
    expect(getState().checkins[dailyId('stelios', addDays(today, -1))]?.meals).toEqual(['b'])
    fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(screen.getByRole('heading', { name: 'Today’s meals' })).toBeTruthy()
  })

  it('guides an athlete without a plan and still lets them rate the day', () => {
    seed()
    ui(<FuelPage />)
    expect(screen.getByText('No meal plan yet')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Create my plan/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'On plan' }))
    expect(todayRow()).toMatchObject({ rating: 'on', planId: null })
  })

  it('offers the coach to create their own plan', () => {
    seed({ meId: 'dennis' })
    ui(<FuelPage />)
    expect(screen.getByRole('link', { name: /Create my plan/ }).getAttribute('href')).toBe('/coach/plan/dennis/new')
  })

  it('lists earlier plans collapsed', () => {
    seed({ plans: [cut, oldCut] })
    ui(<FuelPage />)
    const toggle = screen.getByRole('button', { name: /Earlier plans/ })
    expect(screen.queryByText('Cut phase · v1')).toBeNull()
    fireEvent.click(toggle)
    expect(screen.getByText('Cut phase · v1')).toBeTruthy()
  })
})

describe('TodayNutritionCard', () => {
  it('summarises today and links to /fuel', () => {
    seed({ plans: [cut], checkins: [mkCheckin('stelios', today, { meals: ['b', 'l'], planId: 'cut' })] })
    ui(<TodayNutritionCard memberId="stelios" />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/fuel')
    expect(link.getAttribute('aria-label')).toMatch(/2 of 3 meals/)
    expect(link.textContent).toMatch(/1,300/)
    expect(link.textContent).toMatch(/of 2,000 kcal/)
  })

  it('shows a subtle empty state without a plan', () => {
    seed()
    ui(<TodayNutritionCard memberId="stelios" />)
    expect(screen.getByText('No plan yet')).toBeTruthy()
  })
})

describe('CoachNutritionTab', () => {
  it('shows every athlete with plan, adherence and editor links', () => {
    seed({
      meId: 'dennis',
      plans: [cut, oldCut],
      checkins: [mkCheckin('stelios', addDays(today, -1), { rating: 'on', planId: 'cut' })],
    })
    ui(<CoachNutritionTab />)
    const s = screen.getByRole('region', { name: 'Stelios' })
    expect(within(s).getByText('Cut phase · v2')).toBeTruthy()
    expect(within(s).getByText('Yesterday')).toBeTruthy()
    expect(
      within(s)
        .getByRole('link', { name: /Edit plan/ })
        .getAttribute('href'),
    ).toBe('/coach/plan/stelios/cut')
    fireEvent.click(within(s).getByRole('button', { name: /History/ }))
    expect(
      within(s)
        .getByRole('link', { name: /Cut phase · v1/ })
        .getAttribute('href'),
    ).toBe('/coach/plan/stelios/old')
    const th = screen.getByRole('region', { name: 'Thanos' })
    expect(within(th).getByText('No active plan')).toBeTruthy()
    expect(
      within(th)
        .getByRole('link', { name: /New plan/ })
        .getAttribute('href'),
    ).toBe('/coach/plan/thanos/new')
    expect(screen.queryByRole('region', { name: 'Dennis' })).toBeNull()
  })
})

describe('MealPlanEditorPage', () => {
  const editor = (path: string) =>
    ui(
      <Routes>
        <Route path="/coach/plan/:slug/:planId" element={<MealPlanEditorPage />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>,
      path,
    )

  it('creates an active plan and moves the old one to history', () => {
    seed({ meId: 'dennis', plans: [cut] })
    editor('/coach/plan/stelios/new')
    fireEvent.click(screen.getByRole('button', { name: /Save plan/ }))
    expect(screen.getByText('Required')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Maintenance' } })
    fireEvent.click(screen.getByRole('button', { name: /Add meal/ }))
    fireEvent.click(screen.getByRole('button', { name: /Save plan/ }))
    const plans = Object.values(getState().mealPlans)
    const created = plans.find((p) => p.title === 'Maintenance')!
    expect(created).toMatchObject({ memberId: 'stelios', active: true, createdBy: 'dennis', startDate: today })
    expect(created.meals).toHaveLength(1)
    expect(created.meals[0].name).toBe('Breakfast')
    expect(getState().mealPlans.cut.active).toBe(false)
    expect(screen.getByText('elsewhere')).toBeTruthy()
  })

  it('duplicates the previous plan when creating', () => {
    seed({ meId: 'dennis', plans: [cut] })
    editor('/coach/plan/stelios/new')
    fireEvent.click(screen.getByRole('button', { name: /Copy/ }))
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Cut phase · v3')
    fireEvent.click(screen.getByRole('button', { name: /Save plan/ }))
    const copy = Object.values(getState().mealPlans).find((p) => p.title === 'Cut phase · v3')!
    expect(copy.meals.map((m) => m.name)).toEqual(['Breakfast', 'Lunch', 'Dinner'])
    expect(copy.meals.map((m) => m.id)).not.toContain('b')
  })

  it('deletes a plan after confirming and re-activates the previous one', async () => {
    seed({ meId: 'dennis', plans: [cut, oldCut] })
    editor('/coach/plan/stelios/cut')
    fireEvent.click(screen.getByRole('button', { name: /Delete plan/ }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    })
    expect(getState().mealPlans.cut).toBeUndefined()
    expect(getState().mealPlans.old.active).toBe(true)
  })

  it('refuses an athlete editing someone else’s plan', () => {
    seed({ meId: 'thanos', plans: [cut] })
    editor('/coach/plan/stelios/cut')
    expect(screen.getByText('You can only edit your own meal plans.')).toBeTruthy()
  })
})
