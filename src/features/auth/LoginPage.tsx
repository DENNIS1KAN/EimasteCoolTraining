import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useT } from '../../i18n'
import { COMMON } from '../../i18n/common'
import { signIn, useStore } from '../../data/store'
import type { LoginProfile } from '../../data/types'
import { BrandMark } from '../../app/Brand'
import { Banner, Button, EmptyState, Icon, Skeleton } from '../../ui'
import { memberColorVar } from '../../ui/member'
import { AuthScreen } from './AuthScreen'
import { authErrorKey, type AuthErrorKey } from './errors'
import { getLastProfile, setLastProfile } from './lastProfile'
import { AUTH, SETUP_GUIDE_URL } from './messages'
import { PasswordField } from './PasswordField'
import { FormError } from './PasswordRules'
import { ProfileTile } from './ProfileTile'
import { useLoginProfiles } from './useLoginProfiles'
import './install'

/** Signed-out start screen: pick your profile, type your password (demo mode: tap and you're in). */
export default function LoginPage() {
  const t = useT(AUTH)
  const c = useT(COMMON)
  const demo = useStore((s) => s.backend) === 'demo'
  const squad = useLoginProfiles()
  const { status, profiles, retry } = squad
  const loadError = squad.status === 'error' ? authErrorKey(squad.error, 'login') : null
  const [selected, setSelected] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<AuthErrorKey | null>(null)
  const pwRef = useRef<HTMLInputElement>(null)
  const restored = useRef(false)

  // Start on the profile last picked on this device.
  useEffect(() => {
    if (restored.current || status !== 'ready' || demo) return
    restored.current = true
    const last = getLastProfile()
    if (last && profiles.some((p) => p.slug === last && p.joined)) setSelected(last)
  }, [status, profiles, demo])

  const current = profiles.find((p) => p.slug === selected) ?? null

  const go = async (p: LoginProfile, pw: string) => {
    setBusy(p.slug)
    setError(null)
    try {
      await signIn(p.slug, pw)
    } catch (e) {
      setError(authErrorKey(e, 'login'))
      setBusy(null)
      if (!demo) requestAnimationFrame(() => pwRef.current?.select())
    }
  }

  const pick = (p: LoginProfile) => {
    if (busy) return
    setError(null)
    setLastProfile(p.slug)
    if (demo && p.joined) {
      setSelected(p.slug)
      void go(p, '')
      return
    }
    if (p.slug !== selected) setPassword('')
    setSelected(p.slug)
    if (p.joined) requestAnimationFrame(() => pwRef.current?.focus())
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!current || !password || busy) return
    void go(current, password)
  }

  return (
    <AuthScreen glow={current ? memberColorVar(current.color) : undefined} className="auth--login" texture={false}>
      <section className="auth-hero" aria-labelledby="auth-title">
        <span className="auth__texture" aria-hidden="true">
          Είμαστε
        </span>
        <BrandMark size={64} className="auth-hero__mark" />
        <h1 id="auth-title" className="auth-hero__title">
          <span>Eimaste</span> <span className="auth-hero__cool">Cool</span>
          <span className="auth-hero__sub">Training</span>
        </h1>
        <p className="auth-hero__tagline">{t('tagline')}</p>
        <p className="auth-hero__lede">{t('taglineSub')}</p>
      </section>

      <div className="auth-side">
        <section className="auth-panel" aria-labelledby="auth-who">
          <div className="auth-panel__head">
            <h2 id="auth-who" className="auth-panel__title">
              {t('whosTraining')}
            </h2>
            <p className="auth-panel__hint">{demo ? t('pickHintDemo') : t('pickHint')}</p>
          </div>

          {status === 'loading' && !profiles.length ? (
            <ul className="auth-tiles" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="auth-tile-wrap">
                  <div className="auth-tile auth-tile--skeleton">
                    <Skeleton width={54} height={54} radius={999} />
                    <Skeleton width={64} height={12} />
                    <Skeleton width={44} height={9} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {status === 'error' ? (
            <Banner
              tone="danger"
              role="alert"
              title={t('loadError')}
              action={
                <Button size="sm" variant="secondary" icon="refresh" onClick={retry}>
                  {c('retry')}
                </Button>
              }
            >
              {t(loadError === 'errOffline' ? 'errOffline' : 'errGeneric')}
            </Banner>
          ) : null}

          {status === 'ready' && !profiles.length ? (
            <EmptyState
              icon="users"
              title={t('noProfilesTitle')}
              body={t('noProfilesBody')}
              action={
                <a className="auth-link" href={SETUP_GUIDE_URL} target="_blank" rel="noreferrer">
                  {t('setupGuide')}
                  <Icon name="external" size={14} />
                </a>
              }
            />
          ) : null}

          {profiles.length ? (
            <ul className="auth-tiles">
              {profiles.map((p) => (
                <ProfileTile
                  key={p.id}
                  profile={p}
                  selected={selected === p.slug}
                  busy={busy === p.slug}
                  disabled={!!busy && busy !== p.slug}
                  onSelect={pick}
                />
              ))}
            </ul>
          ) : null}

          {current && !current.joined ? (
            <div className="auth-note" role="status">
              <Icon name="link" size={18} />
              <div>
                <p className="auth-note__title">{t('notJoinedTitle', { name: current.name })}</p>
                <p className="auth-note__body">{t('notJoinedBody')}</p>
              </div>
            </div>
          ) : null}

          {demo && error ? (
            <Banner tone="danger" role="alert">
              {t(error)}
            </Banner>
          ) : null}

          {!demo && current?.joined ? (
            <form className="auth-form" onSubmit={submit} noValidate>
              <input
                className="visually-hidden"
                type="text"
                name="username"
                autoComplete="username"
                value={current.slug}
                readOnly
                tabIndex={-1}
                aria-hidden="true"
              />
              <PasswordField
                ref={pwRef}
                label={t('passwordFor', { name: current.name })}
                name="password"
                autoComplete="current-password"
                enterKeyHint="go"
                value={password}
                onChange={(v) => {
                  setPassword(v)
                  if (error) setError(null)
                }}
                error={!!error}
                describedBy={error ? 'auth-login-error' : undefined}
              />
              {error ? <FormError id="auth-login-error">{t(error)}</FormError> : null}
              <Button type="submit" variant="primary" size="lg" block loading={!!busy} disabled={!password} iconRight="arrow-right">
                {busy ? t('signingIn') : t('signIn')}
              </Button>
              <p className="auth-form__foot">{t('forgot')}</p>
            </form>
          ) : null}
        </section>

        {demo ? (
          <footer className="auth-demo">
            <span className="auth-demo__dot" aria-hidden="true" />
            <p>
              <strong>{t('demoTitle')}</strong> · {t('demoBody')}{' '}
              <a className="auth-link" href={SETUP_GUIDE_URL} target="_blank" rel="noreferrer">
                {t('setupGuide')}
                <Icon name="external" size={13} />
              </a>
            </p>
          </footer>
        ) : null}
      </div>
    </AuthScreen>
  )
}
