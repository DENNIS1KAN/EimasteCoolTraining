import { useState, type FormEvent } from 'react'
import { useT } from '../../i18n'
import { COMMON } from '../../i18n/common'
import { getBackend, signOut, useStore, useSync } from '../../data/store'
import type { Member } from '../../data/types'
import { Button, ConfirmSheet, Icon, Sheet, toast } from '../../ui'
import { authError, authErrorVars, type AuthError } from '../auth/errors'
import { AUTH } from '../auth/messages'
import { checkPassword } from '../auth/password'
import { PasswordField } from '../auth/PasswordField'
import { FormError, PasswordRules } from '../auth/PasswordRules'
import { SETTINGS } from './messages'
import { Section } from './Section'

function PasswordSheet({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const t = useT(SETTINGS)
  const a = useT(AUTH)
  const c = useT(COMMON)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  const check = checkPassword(pw, confirm)

  const close = () => {
    if (busy) return
    setPw('')
    setConfirm('')
    setError(null)
    onClose()
  }
  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!check.ok || busy) return
    setBusy(true)
    setError(null)
    try {
      await getBackend().changePassword(pw)
      toast(t('passwordChanged'), { tone: 'good' })
      setBusy(false)
      setPw('')
      setConfirm('')
      onClose()
    } catch (err) {
      setError(authError(err, 'password'))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t('changePassword')}
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" block onClick={close} disabled={busy}>
            {c('cancel')}
          </Button>
          <Button variant="primary" block onClick={() => void submit()} loading={busy} disabled={!check.ok}>
            {c('save')}
          </Button>
        </>
      }
    >
      <form className="set-pw" onSubmit={submit} noValidate>
        <input
          className="visually-hidden"
          type="text"
          name="username"
          autoComplete="username"
          value={slug}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
        />
        <PasswordField
          label={t('newPassword')}
          autoComplete="new-password"
          value={pw}
          onChange={(v) => {
            setPw(v)
            setError(null)
          }}
          shown={shown}
          onShownChange={setShown}
          data-autofocus
          error={error?.key === 'errPasswordRejected'}
          describedBy="set-pw-rules"
        />
        <PasswordField
          label={t('confirmPassword')}
          autoComplete="new-password"
          enterKeyHint="done"
          value={confirm}
          onChange={(v) => {
            setConfirm(v)
            setError(null)
          }}
          shown={shown}
          noToggle
          describedBy="set-pw-rules"
        />
        <PasswordRules id="set-pw-rules" check={check} />
        {error ? <FormError>{a(error.key, authErrorVars(error))}</FormError> : null}
        <button type="submit" hidden tabIndex={-1} />
      </form>
    </Sheet>
  )
}

/** Change password (shared mode only) and sign out (with a warning when unsynced changes would be lost). */
export function AccountSection({ me }: { me: Member }) {
  const t = useT(SETTINGS)
  const c = useT(COMMON)
  const demo = useStore((s) => s.backend) === 'demo'
  const sync = useSync()
  const [pwOpen, setPwOpen] = useState(false)
  const [outOpen, setOutOpen] = useState(false)
  const risky = !demo && sync.pending > 0

  return (
    <Section id="account" icon="lock" title={t('account')} sub={t('signedInAs', { name: me.name })}>
      {demo ? (
        <p className="set-note">
          <Icon name="info" size={16} />
          {t('demoNoPassword')}
        </p>
      ) : (
        <button type="button" className="set-row" onClick={() => setPwOpen(true)}>
          <span className="set-row__icon" aria-hidden="true">
            <Icon name="edit" size={18} />
          </span>
          <span className="set-row__text">
            <span className="set-row__title">{t('changePassword')}</span>
          </span>
          <Icon name="chevron-right" size={18} className="set-row__chev" />
        </button>
      )}
      <Button variant="secondary" icon="logout" block onClick={() => setOutOpen(true)}>
        {c('signOut')}
      </Button>
      {demo ? null : <PasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} slug={me.slug} />}
      <ConfirmSheet
        open={outOpen}
        onClose={() => setOutOpen(false)}
        title={t('signOutTitle')}
        body={
          <>
            <p>{demo ? t('signOutBodyDemo') : t('signOutBody')}</p>
            {risky ? (
              <p className="set-warn">
                <Icon name="alert" size={16} />
                {t('signOutPending', { n: sync.pending })}
              </p>
            ) : null}
          </>
        }
        confirmLabel={c('signOut')}
        danger
        // Back to the start screen, so whoever signs in next lands on Home, not on these settings.
        onConfirm={() => signOut().finally(() => void (window.location.hash = '#/login'))}
      />
    </Section>
  )
}
