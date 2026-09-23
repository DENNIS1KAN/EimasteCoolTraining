import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetForTests, getState, setState } from '../../data/store'

import { MINI, mkMember } from '../../lib/testing/fixtures'
import { ProfileSection } from './ProfileSection'

const S = mkMember({ id: 's', slug: 'stelios', name: 'Stelios', heightCm: 180 })

beforeEach(() => {
  __resetForTests()
  setState({ status: 'ready', meId: 's', members: { s: S }, programs: { [MINI.id]: MINI } })
})
afterEach(cleanup)

const height = () => getState().members.s.heightCm
const field = () => screen.getByLabelText('Height') as HTMLInputElement

describe('ProfileSection height', () => {
  it('stores only valid heights while typing', () => {
    render(<ProfileSection me={S} />)
    fireEvent.focus(field())
    fireEvent.change(field(), { target: { value: '' } })
    expect(height()).toBe(180) // cleared, not committed yet
    fireEvent.change(field(), { target: { value: '1' } })
    fireEvent.blur(field())
    expect(height()).toBe(180) // "1" is out of range: the old height stays
    fireEvent.focus(field())
    fireEvent.change(field(), { target: { value: '175' } })
    expect(height()).toBe(175)
  })

  it('clears the height when the field is left empty', () => {
    render(<ProfileSection me={S} />)
    fireEvent.focus(field())
    fireEvent.change(field(), { target: { value: '' } })
    fireEvent.blur(field())
    expect(height()).toBeNull()
  })
})
