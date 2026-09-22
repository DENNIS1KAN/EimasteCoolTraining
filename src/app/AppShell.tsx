import { Outlet } from 'react-router'

export function AppShell() {
  return (
    <div className="shell">
      <Outlet />
    </div>
  )
}
