import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useMe, useStore, useSync } from '../data/store'
import type { Member } from '../data/types'
import { defineMessages, useT } from '../i18n'
import { COMMON } from '../i18n/common'
import { unseenCheers } from '../lib/stats'
import { Avatar, Banner, Icon, Toaster, openAccountSheet, type IconName } from '../ui'
import { memberColorVar } from '../ui/member'
import { AccountSheet } from './AccountSheet'
import { PageFallback } from './BootScreens'
import { Brand } from './Brand'
import './AppShell.css'

// The rest timer keeps running (and stays visible) on every screen once a set is ticked.
const RestTimerHost = lazy(() => import('../features/train/RestTimer').then((m) => ({ default: m.RestTimerHost })))

const M = defineMessages(
  {
    mainNav: 'Main',
    moreNav: 'More',
    skip: 'Skip to content',
    newActivity: 'new messages',
    pendingOne: '1 change waiting.',
    pendingMany: '{n} changes waiting.',
    dismiss: 'Dismiss',
    account: 'Account: {name}',
    home: 'Eimaste Cool Training, home',
  },
  {
    mainNav: 'Κύρια πλοήγηση',
    moreNav: 'Περισσότερα',
    skip: 'Μετάβαση στο περιεχόμενο',
    newActivity: 'νέα μηνύματα',
    pendingOne: '1 αλλαγή σε αναμονή.',
    pendingMany: '{n} αλλαγές σε αναμονή.',
    dismiss: 'Απόκρυψη',
    account: 'Λογαριασμός: {name}',
    home: 'Eimaste Cool Training, αρχική',
  },
)

type NavKey = 'home' | 'train' | 'body' | 'fuel' | 'squad' | 'coach' | 'settings'

interface NavItem {
  key: NavKey
  to: string
  icon: IconName
  label: 'home' | 'train' | 'body' | 'fuel' | 'squad' | 'coachConsole' | 'settings'
}

const TABS: NavItem[] = [
  { key: 'home', to: '/', icon: 'home', label: 'home' },
  { key: 'train', to: '/train', icon: 'train', label: 'train' },
  { key: 'body', to: '/body', icon: 'body', label: 'body' },
  { key: 'fuel', to: '/fuel', icon: 'fuel', label: 'fuel' },
  { key: 'squad', to: '/squad', icon: 'squad', label: 'squad' },
]
const COACH: NavItem = { key: 'coach', to: '/coach', icon: 'whistle', label: 'coachConsole' }
const SETTINGS: NavItem = { key: 'settings', to: '/settings', icon: 'settings', label: 'settings' }

const under = (p: string, base: string) => p === base || p.startsWith(base + '/')

/** Which nav item a path belongs to (lift history is part of Train, member profiles part of Squad). */
function navKeyFor(pathname: string): NavKey | null {
  if (pathname === '/' || pathname === '') return 'home'
  if (under(pathname, '/train') || under(pathname, '/lift')) return 'train'
  if (under(pathname, '/body')) return 'body'
  if (under(pathname, '/fuel')) return 'fuel'
  if (under(pathname, '/squad') || under(pathname, '/member')) return 'squad'
  if (under(pathname, '/coach')) return 'coach'
  if (under(pathname, '/settings')) return 'settings'
  return null
}

const prefersReducedMotion = (): boolean => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const DEMO_BANNER_KEY = 'ect-demo-banner-hidden'
function readSession(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function writeSession(key: string): void {
  try {
    sessionStorage.setItem(key, '1')
  } catch {
    /* private mode: the banner simply comes back */
  }
}

/**
 * The frame every signed-in page renders in: banners, the page (with a 160 ms entrance), the bottom tab bar on
 * phones or the left sidebar on desktop, the account sheet and the toaster.
 */
export function AppShell() {
  const t = useT(M)
  const me = useMe()
  const { pathname } = useLocation()
  const active = navKeyFor(pathname)
  const unseen = useStore((s) => (s.meId ? unseenCheers(s.cheers, s.meId).length : 0))
  const pageRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const firstPath = useRef(true)

  // New page: back to the top and a short fade/rise. Query-only changes (tabs in the URL) keep the scroll.
  useLayoutEffect(() => {
    if (firstPath.current) {
      firstPath.current = false
      return
    }
    window.scrollTo(0, 0)
    if (prefersReducedMotion()) return
    // Animates `top` (relative offset), not transform, so position:fixed docks inside pages stay put.
    pageRef.current?.animate?.(
      [
        { opacity: 0, top: '6px' },
        { opacity: 1, top: '0px' },
      ],
      { duration: 160, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    )
  }, [pathname])

  const skipToContent = () => mainRef.current?.focus()

  const style = { '--viewer': memberColorVar(me?.color) } as CSSProperties

  return (
    <div className="app-shell" style={style}>
      <button type="button" className="app-skip" onClick={skipToContent}>
        {t('skip')}
      </button>

      <Sidebar me={me} active={active} unseen={unseen} />

      <div className="app-main">
        <main id="main" ref={mainRef} className="app-content" tabIndex={-1}>
          <ShellBanners />
          <div className="app-page" ref={pageRef}>
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <nav className="app-tabbar" aria-label={t('mainNav')}>
        {TABS.map((item) => (
          <NavLink key={item.key} item={item} active={active === item.key} dot={item.key === 'squad' && unseen > 0} variant="tab" />
        ))}
      </nav>

      <AccountSheet />
      <Toaster />
      <Suspense fallback={null}>
        <RestTimerHost global />
      </Suspense>
    </div>
  )
}

function NavLink({ item, active, dot, variant }: { item: NavItem; active: boolean; dot?: boolean; variant: 'tab' | 'side' }) {
  const tc = useT(COMMON)
  const t = useT(M)
  const { pathname, search } = useLocation()
  const label = tc(item.label)
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Tapping the tab you're already on (its root, no sub-page) scrolls back to the top, like native tab bars.
    if (pathname === item.to && !search && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    }
  }
  const badge = dot ? <span className="app-dot" aria-hidden="true" /> : null
  const srBadge = dot ? <span className="visually-hidden">, {t('newActivity')}</span> : null

  if (variant === 'tab') {
    return (
      <Link to={item.to} className="app-tab" aria-current={active ? 'page' : undefined} onClick={onClick}>
        <span className="app-tab__pill">
          <Icon name={item.icon} size={20} />
          {badge}
        </span>
        <span className="app-tab__label">
          {label}
          {srBadge}
        </span>
      </Link>
    )
  }
  return (
    <Link to={item.to} className="app-side-link" aria-current={active ? 'page' : undefined} onClick={onClick}>
      <span className="app-side-link__icon">
        <Icon name={item.icon} size={20} />
        {badge}
      </span>
      <span>
        {label}
        {srBadge}
      </span>
    </Link>
  )
}

function Sidebar({ me, active, unseen }: { me: Member | null; active: NavKey | null; unseen: number }) {
  const t = useT(M)
  const tc = useT(COMMON)
  const extra = me?.role === 'coach' ? [COACH, SETTINGS] : [SETTINGS]
  return (
    <aside className="app-sidebar">
      <Link to="/" className="app-sidebar__brand" aria-label={t('home')}>
        <Brand size="md" />
      </Link>
      <nav aria-label={t('mainNav')}>
        <ul className="app-sidebar__nav">
          {TABS.map((item) => (
            <li key={item.key}>
              <NavLink item={item} active={active === item.key} dot={item.key === 'squad' && unseen > 0} variant="side" />
            </li>
          ))}
        </ul>
        <div className="app-sidebar__sep" role="presentation" />
        <ul className="app-sidebar__nav" aria-label={t('moreNav')}>
          {extra.map((item) => (
            <li key={item.key}>
              <NavLink item={item} active={active === item.key} variant="side" />
            </li>
          ))}
        </ul>
      </nav>
      {me ? (
        <div className="app-sidebar__foot">
          <button
            type="button"
            className="app-me"
            aria-haspopup="dialog"
            aria-label={t('account', { name: me.name })}
            onClick={() => openAccountSheet()}
          >
            <Avatar member={me} size={40} decorative />
            <span className="app-me__text">
              <span className="app-me__name">{me.name}</span>
              <span className="app-me__role">{me.role === 'coach' ? tc('coach') : tc('athlete')}</span>
            </span>
            <Icon name="more" size={20} />
          </button>
        </div>
      ) : null}
    </aside>
  )
}

function ShellBanners() {
  const t = useT(M)
  const tc = useT(COMMON)
  const backend = useStore((s) => s.backend)
  const sync = useSync()
  const [demoHidden, setDemoHidden] = useState(() => readSession(DEMO_BANNER_KEY))
  const [dismissedError, setDismissedError] = useState<string | null>(null)

  // A new, different error shows again even after an earlier one was dismissed.
  useEffect(() => {
    if (!sync.error) setDismissedError(null)
  }, [sync.error])

  const showDemo = backend === 'demo' && !demoHidden
  const showOffline = !sync.online
  const showError = !!sync.error && sync.error !== dismissedError
  if (!showDemo && !showOffline && !showError) return null

  const pending = sync.pending > 0 ? (sync.pending === 1 ? t('pendingOne') : t('pendingMany', { n: sync.pending })) : ''

  return (
    <div className="app-banners">
      {showError ? (
        <Banner tone="danger" icon="alert" role="alert" onDismiss={() => setDismissedError(sync.error)}>
          {tc('syncError')} <span className="app-banner__meta">{sync.error}</span>
        </Banner>
      ) : null}
      {showOffline ? (
        <Banner tone="warn" icon="wifi-off" role="status">
          {tc('offline')}
          {pending ? <span className="app-banner__meta"> {pending}</span> : null}
        </Banner>
      ) : null}
      {showDemo ? (
        <Banner
          tone="info"
          icon="info"
          onDismiss={() => {
            writeSession(DEMO_BANNER_KEY)
            setDemoHidden(true)
          }}
        >
          {tc('demoMode')} <Link to="/settings">{tc('settings')}</Link>
        </Banner>
      ) : null}
    </div>
  )
}
