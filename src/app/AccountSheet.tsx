import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { getState, signOut, useMe, useStore } from '../data/store'
import { defineMessages, setLang, useLang, useT, type Lang } from '../i18n'
import { COMMON } from '../i18n/common'
import { Avatar, ConfirmSheet, Icon, Segmented, Sheet, Tag, onAccountSheet, toast, type IconName } from '../ui'
import { setThemePref, useThemePref, type ThemePref } from './theme'
import './AppShell.css'

const M = defineMessages(
  {
    account: 'Account',
    switchProfile: 'Switch profile',
    appearance: 'Appearance',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    language: 'Language',
    signOutTitle: 'Sign out?',
    signOutBody: "You'll need your password to sign back in.",
    signOutBodyDemo: 'Your demo data stays on this device.',
    signOutPending: '{n} changes have not reached the server yet. Signing out now will lose them.',
    signOutPendingOne: '1 change has not reached the server yet. Signing out now will lose it.',
    signOutFailed: 'Could not sign out. Try again.',
  },
  {
    account: 'Λογαριασμός',
    switchProfile: 'Αλλαγή προφίλ',
    appearance: 'Εμφάνιση',
    system: 'Σύστημα',
    light: 'Φωτεινό',
    dark: 'Σκοτεινό',
    language: 'Γλώσσα',
    signOutTitle: 'Αποσύνδεση;',
    signOutBody: 'Θα χρειαστείς τον κωδικό σου για να ξανασυνδεθείς.',
    signOutBodyDemo: 'Τα δεδομένα επίδειξης μένουν σε αυτή τη συσκευή.',
    signOutPending: '{n} αλλαγές δεν έχουν φτάσει ακόμη στον διακομιστή. Αν αποσυνδεθείς τώρα, θα χαθούν.',
    signOutPendingOne: '1 αλλαγή δεν έχει φτάσει ακόμη στον διακομιστή. Αν αποσυνδεθείς τώρα, θα χαθεί.',
    signOutFailed: 'Η αποσύνδεση απέτυχε. Ξαναδοκίμασε.',
  },
)

/*
 * Open state lives at module level so the sheet survives a remount of the shell. A language switch no longer
 * remounts anything (it re-renders in place, keeping open forms), so tapping ΕΛ simply re-renders the sheet in Greek.
 */
let keepOpen = false

type Mode = 'closed' | 'account' | 'confirm-signout'

/** The viewer's account sheet: profile, links, theme and language. Opened with openAccountSheet() from src/ui. */
export function AccountSheet() {
  const t = useT(M)
  const tc = useT(COMMON)
  const me = useMe()
  const backend = useStore((s) => s.backend)
  const pending = useStore((s) => s.sync.pending)
  const theme = useThemePref()
  const lang = useLang()
  const [mode, setMode] = useState<Mode>(() => (keepOpen ? 'account' : 'closed'))
  const [busy, setBusy] = useState(false)
  const signingOut = useRef(false)

  useEffect(
    () =>
      onAccountSheet(() => {
        keepOpen = true
        setMode('account')
      }),
    [],
  )

  const close = () => {
    keepOpen = false
    setMode('closed')
  }

  // Both "Sign out" and "Switch profile" end on #/login, so the next person never lands on the previous member's
  // screen (signed out, every path shows the login page, and signing in would reopen that path).
  const doSignOut = async () => {
    signingOut.current = true
    setBusy(true)
    keepOpen = false
    try {
      await signOut()
    } catch {
      toast(t('signOutFailed'), { tone: 'danger' })
    } finally {
      if (getState().status === 'signed-out') window.location.hash = '#/login'
      signingOut.current = false
      setBusy(false)
      setMode('closed')
    }
  }

  if (!me) return null
  const isCoach = me.role === 'coach'
  const isDemo = backend === 'demo'

  const signOutBody = [
    isDemo ? t('signOutBodyDemo') : t('signOutBody'),
    !isDemo && pending > 0 ? (pending === 1 ? t('signOutPendingOne') : t('signOutPending', { n: pending })) : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <Sheet open={mode === 'account'} onClose={close} title={t('account')}>
        <div className="acct">
          <div className="acct__who">
            <Avatar member={me} size={54} decorative />
            <div className="acct__who-text">
              <p className="acct__name">{me.name}</p>
              <div className="acct__role">
                <span>{isCoach ? tc('coach') : tc('athlete')}</span>
                {isDemo ? <Tag tone="accent">{tc('demoTitle')}</Tag> : null}
              </div>
            </div>
          </div>

          <ul className="acct__group">
            <li>
              <RowLink to="/settings" icon="settings" onClick={close}>
                {tc('settings')}
              </RowLink>
            </li>
            {isCoach ? (
              <li>
                <RowLink to="/coach" icon="whistle" onClick={close}>
                  {tc('coachConsole')}
                </RowLink>
              </li>
            ) : null}
          </ul>

          <div className="acct__field">
            <span className="acct__label">{t('appearance')}</span>
            <Segmented<ThemePref>
              ariaLabel={t('appearance')}
              block
              value={theme}
              onChange={(v) => setThemePref(v)}
              options={[
                { value: 'system', label: t('system'), icon: 'monitor' },
                { value: 'light', label: t('light'), icon: 'sun' },
                { value: 'dark', label: t('dark'), icon: 'moon' },
              ]}
            />
          </div>

          <div className="acct__field">
            <span className="acct__label">{t('language')}</span>
            <Segmented<Lang>
              ariaLabel={t('language')}
              block
              value={lang}
              onChange={(v) => setLang(v)}
              options={[
                { value: 'en', label: 'EN', ariaLabel: 'English' },
                { value: 'el', label: 'ΕΛ', ariaLabel: 'Ελληνικά' },
              ]}
            />
          </div>

          <ul className="acct__group">
            {isDemo ? (
              <li>
                <RowButton icon="swap" disabled={busy} onClick={() => void doSignOut()}>
                  {t('switchProfile')}
                </RowButton>
              </li>
            ) : null}
            <li>
              <RowButton icon="logout" danger disabled={busy} onClick={() => setMode('confirm-signout')}>
                {tc('signOut')}
              </RowButton>
            </li>
          </ul>
        </div>
      </Sheet>

      <ConfirmSheet
        open={mode === 'confirm-signout'}
        title={t('signOutTitle')}
        body={signOutBody}
        confirmLabel={tc('signOut')}
        danger
        onConfirm={() => void doSignOut()}
        onClose={() => {
          // Cancel returns to the account sheet; closing because we're signing out does not.
          if (!signingOut.current) setMode('account')
        }}
      />
    </>
  )
}

function RowLink({ to, icon, onClick, children }: { to: string; icon: IconName; onClick: () => void; children: ReactNode }) {
  return (
    <Link to={to} className="acct__item" onClick={onClick}>
      <Icon name={icon} size={20} />
      <span>{children}</span>
      <Icon name="chevron-right" size={18} className="acct__chev" />
    </Link>
  )
}

function RowButton({
  icon,
  danger,
  disabled,
  onClick,
  children,
}: {
  icon: IconName
  danger?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className={danger ? 'acct__item acct__item--danger' : 'acct__item'} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={20} />
      <span>{children}</span>
    </button>
  )
}
