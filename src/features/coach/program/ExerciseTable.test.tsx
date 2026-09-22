import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { BTS_PROGRAM } from '../../../data/programs'
import { setLang } from '../../../i18n'
import { MINI } from '../../../lib/testing/fixtures'
import { PatternStrip } from '../components/PatternStrip'
import { ExerciseTable } from './ExerciseTable'

afterEach(cleanup)

describe('ExerciseTable', () => {
  it('renders one row per exercise with sets × reps, RPE, rest and swaps', () => {
    setLang('en')
    const day = BTS_PROGRAM.weeks[1].days[0]
    render(<ExerciseTable day={day} />)
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(day.ex.length + 1) // + header
    const first = rows[1]
    expect(first.textContent).toContain(day.ex[0].n)
    expect(first.textContent).toContain('×')
    expect(first.textContent).toContain(day.ex[0].s1 ?? '')
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toContain('Sets × reps')
  })
})

describe('PatternStrip', () => {
  it('labels training days and rest days', () => {
    setLang('en')
    render(<PatternStrip program={MINI} label="Weekly pattern" />)
    const list = screen.getByRole('list', { name: 'Weekly pattern' })
    const items = within(list).getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual(['MonUpper', 'TueRest', 'WedLower', 'ThuRest', 'FriFull', 'SatRest', 'SunRest'])
  })
  it('uses real weekdays from the start date', () => {
    setLang('en')
    render(<PatternStrip program={MINI} start="2026-09-23" label="p" />)
    const first = within(screen.getByRole('list', { name: 'p' })).getAllByRole('listitem')[0]
    expect(first.textContent).toBe('WedUpper')
  })
})
