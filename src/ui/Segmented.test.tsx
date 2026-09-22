import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Segmented, Tabs, type SegmentOption } from './Segmented'

afterEach(cleanup)

const RANGE: SegmentOption[] = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: 'all', label: 'All' },
]

function Controlled({ options = RANGE, initial = '1m', onValue }: { options?: SegmentOption[]; initial?: string; onValue?: (v: string) => void }) {
  const [v, setV] = useState(initial)
  return (
    <Segmented
      ariaLabel="Range"
      options={options}
      value={v}
      onChange={(n) => {
        onValue?.(n)
        setV(n)
      }}
    />
  )
}

describe('Segmented', () => {
  it('is a radiogroup with one checked radio and a roving tabindex', () => {
    render(<Controlled initial="3m" />)
    expect(screen.getByRole('radiogroup', { name: 'Range' })).toBeTruthy()
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1])
  })

  it('arrow keys move the selection and the focus, wrapping around', () => {
    const onValue = vi.fn()
    render(<Controlled onValue={onValue} />)
    const [first, second, third] = screen.getAllByRole('radio')
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(onValue).toHaveBeenLastCalledWith('3m')
    expect(document.activeElement).toBe(second)
    expect(second.getAttribute('aria-checked')).toBe('true')
    fireEvent.keyDown(second, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(third)
    fireEvent.keyDown(third, { key: 'ArrowRight' })
    expect(onValue).toHaveBeenLastCalledWith('1m')
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    expect(onValue).toHaveBeenLastCalledWith('all')
    expect(document.activeElement).toBe(third)
  })

  it('Home and End jump to the ends; disabled options are skipped', () => {
    const onValue = vi.fn()
    const opts: SegmentOption[] = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
      { value: 'c', label: 'C' },
      { value: 'd', label: 'D', disabled: true },
    ]
    render(<Controlled options={opts} initial="a" onValue={onValue} />)
    const radios = screen.getAllByRole('radio')
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' })
    expect(onValue).toHaveBeenLastCalledWith('c')
    fireEvent.keyDown(radios[2], { key: 'End' })
    // "d" is disabled, so End lands on the last enabled option (already selected: no change event)
    expect(onValue).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(radios[2])
    fireEvent.keyDown(radios[2], { key: 'Home' })
    expect(onValue).toHaveBeenLastCalledWith('a')
    expect(document.activeElement).toBe(radios[0])
  })

  it('clicking selects', () => {
    const onValue = vi.fn()
    render(<Controlled onValue={onValue} />)
    fireEvent.click(screen.getByRole('radio', { name: 'All' }))
    expect(onValue).toHaveBeenCalledWith('all')
    expect(screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe('true')
  })

  it('Tabs uses tablist semantics', () => {
    const onChange = vi.fn()
    render(
      <Tabs
        ariaLabel="Squad view"
        value="feed"
        onChange={onChange}
        controls={(v) => `panel-${v}`}
        options={[
          { value: 'board', label: 'Board' },
          { value: 'feed', label: 'Feed' },
        ]}
      />,
    )
    expect(screen.getByRole('tablist', { name: 'Squad view' })).toBeTruthy()
    const tab = screen.getByRole('tab', { name: 'Feed' })
    expect(tab.getAttribute('aria-selected')).toBe('true')
    expect(tab.getAttribute('aria-controls')).toBe('panel-feed')
    fireEvent.keyDown(tab, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('board')
  })
})
