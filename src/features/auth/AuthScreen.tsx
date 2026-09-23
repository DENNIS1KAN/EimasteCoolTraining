import type { CSSProperties, ReactNode } from 'react'
import { Brand } from '../../app/Brand'
import { LangToggle } from './LangToggle'
import './auth.css'

interface Props {
  children: ReactNode
  /** Small brand lockup in the top bar (the login page shows a big one in its hero instead). */
  brand?: boolean
  /** A member color that tints the top glow (e.g. the invited member's). */
  glow?: string
  className?: string
  /** The giant outlined name behind the content (the login hero draws its own). */
  texture?: boolean
}

/**
 * Full-screen signed-out splash: the dark "night island" in both themes, with member-color glows,
 * a faint giant outline of the name as texture, and the EN/ΕΛ switch in the corner.
 */
export function AuthScreen({ children, brand, glow, className, texture = true }: Props) {
  const style = glow ? ({ '--auth-glow': glow } as CSSProperties) : undefined
  return (
    <div className={['auth night', className].filter(Boolean).join(' ')} style={style}>
      <div className="auth__bg" aria-hidden="true">
        <span className="auth__glow auth__glow--a" />
        <span className="auth__glow auth__glow--b" />
        <span className="auth__glow auth__glow--c" />
        {texture ? <span className="auth__texture" lang="el">Είμαστε Cool</span> : null}
      </div>
      <header className="auth__top">
        {brand ? <Brand size="sm" layout="inline" className="auth__brand" /> : <span />}
        <LangToggle />
      </header>
      <main className="auth__main">{children}</main>
    </div>
  )
}
