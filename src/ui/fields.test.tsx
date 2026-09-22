import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NumberField, Stepper, canonicalDecimal, decimalsOf, matchesAccept, parseDecimal, sanitizeDecimalDraft } from './fields'

afterEach(cleanup)

describe('decimal helpers', () => {
  it('parseDecimal accepts a comma or a dot', () => {
    expect(parseDecimal('57,5')).toBe(57.5)
    expect(parseDecimal('57.5')).toBe(57.5)
    expect(parseDecimal(' 80,70 ')).toBe(80.7)
    expect(parseDecimal('−2,5')).toBe(-2.5)
    expect(parseDecimal(',5')).toBe(0.5)
    expect(parseDecimal('12')).toBe(12)
    expect(parseDecimal(3.25)).toBe(3.25)
  })

  it('parseDecimal rejects junk', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('1,2,3')).toBeNull()
    expect(parseDecimal('1.2.3')).toBeNull()
    expect(parseDecimal('-')).toBeNull()
    expect(parseDecimal(null)).toBeNull()
    expect(parseDecimal(Number.NaN)).toBeNull()
  })

  it('sanitizeDecimalDraft keeps valid partial input and rejects the rest', () => {
    expect(sanitizeDecimalDraft('57,', 1, false)).toBe('57,')
    expect(sanitizeDecimalDraft('57,5', 1, false)).toBe('57,5')
    expect(sanitizeDecimalDraft('57,55', 1, false)).toBeNull()
    expect(sanitizeDecimalDraft('57,55', 2, false)).toBe('57,55')
    expect(sanitizeDecimalDraft('5,5', 0, false)).toBeNull()
    expect(sanitizeDecimalDraft('-3', 1, false)).toBeNull()
    expect(sanitizeDecimalDraft('-3', 1, true)).toBe('-3')
    expect(sanitizeDecimalDraft('1a', 1, true)).toBeNull()
    expect(sanitizeDecimalDraft(' 8 ', 1, true)).toBe('8')
  })

  it('canonicalDecimal normalizes the separator and dangling characters', () => {
    expect(canonicalDecimal('57,5')).toBe('57.5')
    expect(canonicalDecimal('57,')).toBe('57')
    expect(canonicalDecimal(',')).toBe('')
    expect(canonicalDecimal('-')).toBe('')
    expect(canonicalDecimal(',5')).toBe('0.5')
  })

  it('decimalsOf reads the step precision', () => {
    expect(decimalsOf(0.1)).toBe(1)
    expect(decimalsOf(2.5)).toBe(1)
    expect(decimalsOf(0.25)).toBe(2)
    expect(decimalsOf(1)).toBe(0)
  })

  it('matchesAccept understands mime wildcards and extensions', () => {
    expect(matchesAccept({ name: 'plan.pdf', type: 'application/pdf' }, 'application/pdf,image/*')).toBe(true)
    expect(matchesAccept({ name: 'a.jpg', type: 'image/jpeg' }, 'application/pdf,image/*')).toBe(true)
    expect(matchesAccept({ name: 'a.csv', type: 'text/csv' }, 'application/pdf,image/*')).toBe(false)
    expect(matchesAccept({ name: 'log.CSV', type: '' }, '.csv')).toBe(true)
  })
})

function ControlledNumber(props: { decimals?: number; min?: number; max?: number; onValue: (v: string) => void; initial?: string }) {
  const [v, setV] = useState(props.initial ?? '')
  return (
    <NumberField
      label="Weight"
      value={v}
      decimals={props.decimals}
      min={props.min}
      max={props.max}
      onChange={(s) => {
        props.onValue(s)
        setV(s)
      }}
    />
  )
}

describe('NumberField', () => {
  it('accepts a comma, keeps it on screen and reports a dot-decimal string', () => {
    const onValue = vi.fn()
    render(<ControlledNumber onValue={onValue} />)
    const input = screen.getByLabelText('Weight') as HTMLInputElement
    expect(input.getAttribute('inputmode')).toBe('decimal')
    fireEvent.change(input, { target: { value: '57,' } })
    expect(input.value).toBe('57,')
    expect(onValue).toHaveBeenLastCalledWith('57')
    fireEvent.change(input, { target: { value: '57,5' } })
    expect(input.value).toBe('57,5')
    expect(onValue).toHaveBeenLastCalledWith('57.5')
  })

  it('rejects letters and extra decimals', () => {
    const onValue = vi.fn()
    render(<ControlledNumber onValue={onValue} initial="57.5" />)
    const input = screen.getByLabelText('Weight') as HTMLInputElement
    fireEvent.change(input, { target: { value: '57.55' } })
    expect(input.value).toBe('57.5')
    fireEvent.change(input, { target: { value: '57.5x' } })
    expect(input.value).toBe('57.5')
    expect(onValue).not.toHaveBeenCalled()
  })

  it('clamps to min/max on blur', () => {
    const onValue = vi.fn()
    render(<ControlledNumber onValue={onValue} min={0} max={300} />)
    const input = screen.getByLabelText('Weight') as HTMLInputElement
    fireEvent.change(input, { target: { value: '350,5' } })
    fireEvent.blur(input)
    expect(onValue).toHaveBeenLastCalledWith('300')
    expect(input.value).toBe('300')
  })

  it('uses a numeric keyboard and refuses a separator when decimals is 0', () => {
    const onValue = vi.fn()
    render(<ControlledNumber onValue={onValue} decimals={0} />)
    const input = screen.getByLabelText('Weight') as HTMLInputElement
    expect(input.getAttribute('inputmode')).toBe('numeric')
    fireEvent.change(input, { target: { value: '8,' } })
    expect(input.value).toBe('')
    fireEvent.change(input, { target: { value: '8' } })
    expect(onValue).toHaveBeenLastCalledWith('8')
  })
})

function ControlledStepper({ onValue, initial = 80, max = 250 }: { onValue: (n: number) => void; initial?: number; max?: number }) {
  const [v, setV] = useState(initial)
  return (
    <Stepper
      label="Body weight"
      value={v}
      step={0.1}
      min={30}
      max={max}
      unit="kg"
      onChange={(n) => {
        onValue(n)
        setV(n)
      }}
    />
  )
}

describe('Stepper', () => {
  it('steps without floating point noise', () => {
    const onValue = vi.fn()
    render(<ControlledStepper onValue={onValue} />)
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }))
    expect(onValue).toHaveBeenLastCalledWith(80.1)
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }))
    expect(onValue).toHaveBeenLastCalledWith(80.2)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease' }))
    expect(onValue).toHaveBeenLastCalledWith(80.1)
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('80.1')
  })

  it('accepts a typed value with a comma', () => {
    const onValue = vi.fn()
    render(<ControlledStepper onValue={onValue} />)
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '80,4' } })
    expect(input.value).toBe('80,4')
    expect(onValue).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(onValue).toHaveBeenLastCalledWith(80.4)
    expect(input.value).toBe('80.4')
  })

  it('commits on Enter and steps with the arrow keys', () => {
    const onValue = vi.fn()
    render(<ControlledStepper onValue={onValue} />)
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '81,25' } })
    // two decimals are refused for a 0.1 step
    expect(input.value).toBe('80.0')
    fireEvent.change(input, { target: { value: '81,2' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onValue).toHaveBeenLastCalledWith(81.2)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onValue).toHaveBeenLastCalledWith(81.3)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(onValue).toHaveBeenLastCalledWith(81.1)
  })

  it('clamps to max and disables the button at the limit', () => {
    const onValue = vi.fn()
    render(<ControlledStepper onValue={onValue} initial={249.9} max={250} />)
    const inc = screen.getByRole('button', { name: 'Increase' }) as HTMLButtonElement
    fireEvent.click(inc)
    expect(onValue).toHaveBeenLastCalledWith(250)
    expect(inc.disabled).toBe(true)
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '999' } })
    fireEvent.blur(input)
    expect(onValue).toHaveBeenCalledTimes(1)
    expect(input.value).toBe('250.0')
  })
})
