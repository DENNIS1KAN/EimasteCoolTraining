import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmSheet, Sheet } from './Sheet'

afterEach(cleanup)

function Harness({ onClose, dismissible }: { onClose?: () => void; dismissible?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Sheet
        open={open}
        dismissible={dismissible}
        title="Log weight"
        subtitle="Thu 24 Sep"
        onClose={() => {
          onClose?.()
          setOpen(false)
        }}
        footer={<button onClick={() => setOpen(false)}>Save</button>}
      >
        <input aria-label="Note" />
      </Sheet>
    </>
  )
}

describe('Sheet', () => {
  it('renders nothing while closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="Hidden" />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens as a labelled modal dialog, moves focus in and locks scrolling', () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Log weight' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.documentElement.classList.contains('ui-scroll-locked')).toBe(true)
  })

  it('closes on Escape, unmounts after the exit animation and restores focus', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(trigger)
    expect(document.documentElement.classList.contains('ui-scroll-locked')).toBe(false)
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull())
  })

  it('closes from the backdrop and the close button', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const scrim = document.querySelector('.ui-sheet__scrim') as HTMLElement
    fireEvent.click(scrim)
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('ignores Escape and the backdrop when not dismissible', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} dismissible={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    fireEvent.click(document.querySelector('.ui-sheet__scrim') as HTMLElement)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('traps Tab inside the sheet', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const close = screen.getByRole('button', { name: 'Close' })
    const save = screen.getByRole('button', { name: 'Save' })
    save.focus()
    fireEvent.keyDown(save, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(save)
  })
})

describe('ConfirmSheet', () => {
  it('confirms, waits for an async action and closes', async () => {
    let resolve: () => void = () => {}
    const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    const onClose = vi.fn()
    render(<ConfirmSheet open danger title="Delete this workout?" body="Gone for good." confirmLabel="Delete" onConfirm={onConfirm} onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: 'Delete this workout?' })).toBeTruthy()
    // destructive: the safe action gets the initial focus
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => resolve())
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
