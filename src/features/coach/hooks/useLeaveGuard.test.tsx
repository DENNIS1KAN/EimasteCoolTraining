import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HashRouter, Link, Route, Routes } from 'react-router'
import { appRouteOf, useLeaveGuard } from './useLeaveGuard'

afterEach(() => {
  cleanup()
  window.location.hash = ''
})

function Editor({ dirty }: { dirty: boolean }) {
  const guard = useLeaveGuard(dirty)
  return (
    <div>
      <p>editor</p>
      {guard.pending != null ? (
        <p>
          ask {guard.pending}
          <button onClick={guard.leave}>leave</button>
          <button onClick={guard.stay}>stay</button>
        </p>
      ) : null}
    </div>
  )
}

function App({ dirty }: { dirty: boolean }) {
  return (
    <HashRouter>
      {/* outside the page, like the tab bar */}
      <Link to="/coach?tab=programs">tab</Link>
      <Routes>
        <Route path="/edit" element={<Editor dirty={dirty} />} />
        <Route path="/coach" element={<p>coach</p>} />
      </Routes>
    </HashRouter>
  )
}

describe('useLeaveGuard', () => {
  it('reads in-app routes from anchors only', () => {
    const a = document.createElement('a')
    a.setAttribute('href', '#/coach?tab=programs')
    expect(appRouteOf(a)).toBe('/coach?tab=programs')
    a.setAttribute('target', '_blank')
    expect(appRouteOf(a)).toBeNull()
    const ext = document.createElement('a')
    ext.setAttribute('href', 'https://example.com')
    expect(appRouteOf(ext)).toBeNull()
    expect(appRouteOf(document.createElement('button'))).toBeNull()
  })

  it('holds a link click while dirty, then leaves or stays', () => {
    window.location.hash = '#/edit'
    render(<App dirty />)
    fireEvent.click(screen.getByText('tab'))
    expect(screen.getByText('editor')).toBeTruthy()
    expect(screen.getByText(/ask \/coach\?tab=programs/)).toBeTruthy()
    fireEvent.click(screen.getByText('stay'))
    expect(screen.queryByText(/ask/)).toBeNull()
    fireEvent.click(screen.getByText('tab'))
    act(() => fireEvent.click(screen.getByText('leave')))
    expect(screen.getByText('coach')).toBeTruthy()
  })

  it('lets links through when nothing is unsaved', () => {
    window.location.hash = '#/edit'
    render(<App dirty={false} />)
    fireEvent.click(screen.getByText('tab'))
    expect(screen.getByText('coach')).toBeTruthy()
  })
})
