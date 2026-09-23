import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useT } from '../../i18n'
import { getBackend, signIn, useStore } from '../../data/store'
import type { LoginProfile } from '../../data/types'
import { Avatar, Banner, Button, celebrate, Icon, Skeleton, type IconName } from '../../ui'
import { memberColorVar } from '../../ui/member'
import { AuthScreen } from './AuthScreen'
import { authError, authErrorVars, isFatalJoinError, type AuthError, type AuthErrorKey } from './errors'
import { InstallGuide } from './InstallGuide'
import { forgetJoinLink } from './joinLink'
import { setLastProfile } from './lastProfile'
import { AUTH } from './messages'
import { checkPassword } from './password'
import { PasswordField } from './PasswordField'
import { FormError, PasswordRules } from './PasswordRules'
import { useLoginProfiles } from './useLoginProfiles'
import './install'

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/**
 * /join/:slug?code=XXXX — claim a profile with the coach's invite: choose a password, then a welcome step
 * with Home Screen instructions. The backend join runs first; the session starts on "Let's go", so the
 * welcome step stays on screen (the signed-in routes would otherwise replace this page at once).
 */
export default function JoinPage() {
  const { slug: rawSlug = '' } = useParams()
  const [params] = useSearchParams()
  const code = (params.get('code') || '').trim()
  const slug = rawSlug.trim().toLowerCase()
  // A different invite link starts over (fresh form state).
  return <JoinFlow key={`${slug}|${code}`} slug={slug} code={code} />
}

function JoinFlow({ slug, code }: { slug: string; code: string }) {
  const t = useT(AUTH)
  const navigate = useNavigate()
  const demo = useStore((s) => s.backend) === 'demo'
  const { status, profiles } = useLoginProfiles()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  const [step, setStep] = useState<'form' | 'welcome'>('form')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(false)

  const profile: LoginProfile | null = profiles.find((p) => p.slug === slug) ?? null
  const coach = profiles.find((p) => p.role === 'coach' && p.slug !== slug) ?? null
  const name = profile?.name ?? capitalize(slug)
  const check = checkPassword(password, confirm)
  const unknownProfile = status === 'ready' && !profile
  // An invite that was already used (e.g. the join link saved as a Home Screen icon): straight to signing in.
  const spent = !demo && step === 'form' && !!profile?.joined
  const fatal: AuthErrorKey | null =
    !slug || !code || unknownProfile ? 'errInvalidInvite' : spent ? 'errAlreadyJoined' : error && isFatalJoinError(error.key) ? error.key : null

  const signInInstead = () => {
    setLastProfile(slug)
    navigate('/login', { replace: true })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!check.ok || busy) return
    setBusy(true)
    setError(null)
    try {
      await getBackend().join(slug, code, password)
      setLastProfile(slug)
      forgetJoinLink()
      setStep('welcome')
      celebrate({ intensity: 'big' })
    } catch (err) {
      setError(authError(err, 'join'))
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    setStarting(true)
    setStartError(false)
    try {
      await signIn(slug, password)
      // The signed-in routes take over from here and redirect /join to Home.
    } catch {
      setStartError(true)
      setStarting(false)
    }
  }

  const glow = profile ? memberColorVar(profile.color) : undefined

  if (step === 'welcome') {
    return (
      <AuthScreen brand glow={glow} className="auth--join">
        <section className="join-card join-card--welcome" aria-labelledby="join-welcome">
          <div className="join-card__who">
            <Avatar member={{ name, color: profile?.color }} size={80} decorative />
            <span className="join-card__badge" aria-hidden="true">
              <Icon name="check" size={14} strokeWidth={2.6} />
            </span>
          </div>
          <p className="eyebrow join-card__eyebrow">{t('welcomeEyebrow')}</p>
          <h1 id="join-welcome" className="join-card__title">
            {t('welcomeTitle', { name })}
          </h1>
          <p className="join-card__lede">{t('welcomeBody')}</p>
          <div className="join-card__install">
            <p className="join-card__section">{t('installTitle')}</p>
            <InstallGuide />
          </div>
          {startError ? (
            <Banner tone="danger" role="alert">
              {t('startFailed')}
            </Banner>
          ) : null}
          <Button variant="primary" size="lg" block iconRight="arrow-right" loading={starting} onClick={start}>
            {t('letsGo')}
          </Button>
        </section>
      </AuthScreen>
    )
  }

  if (fatal) {
    const icon: IconName = fatal === 'errAlreadyJoined' ? 'user' : 'link'
    const title = fatal === 'errAlreadyJoined' ? t('alreadyTitle') : fatal === 'errConflict' ? t('conflictTitle') : t('invalidTitle')
    return (
      <AuthScreen brand glow={glow} className="auth--join">
        <section className="join-card join-card--dead" aria-labelledby="join-dead" role="alert">
          <span className="join-card__icon" aria-hidden="true">
            <Icon name={icon} size={26} />
          </span>
          <h1 id="join-dead" className="join-card__title join-card__title--sm">
            {title}
          </h1>
          <p className="join-card__lede">{t(fatal)}</p>
          <Button variant={fatal === 'errAlreadyJoined' ? 'primary' : 'secondary'} size="lg" block iconRight="arrow-right" onClick={signInInstead}>
            {t('signInInstead')}
          </Button>
        </section>
      </AuthScreen>
    )
  }

  const loading = status === 'loading' && !profile
  return (
    <AuthScreen brand glow={glow} className="auth--join">
      <section className="join-card" aria-labelledby="join-title">
        <div className="join-card__who">
          {loading ? <Skeleton width={80} height={80} radius={999} /> : <Avatar member={{ name, color: profile?.color }} size={80} decorative />}
          {coach ? (
            <span className="join-card__coach" title={coach.name}>
              <Avatar member={{ name: coach.name, color: coach.color }} size={32} decorative />
            </span>
          ) : null}
        </div>
        <h1 id="join-title" className="join-card__title">
          {t('joinHi', { name })}
        </h1>
        <p className="join-card__lede">{coach ? t('joinInvitedBy', { coach: coach.name }) : t('joinInvited')}</p>

        {profile?.joined && !demo ? (
          <div className="auth-note">
            <Icon name="user" size={18} />
            <div className="auth-note__col">
              <p className="auth-note__body">{t('alreadyJoinedNote')}</p>
              <Button size="sm" variant="secondary" iconRight="arrow-right" onClick={signInInstead}>
                {t('signInInstead')}
              </Button>
            </div>
          </div>
        ) : null}

        <form className="auth-form join-form" onSubmit={submit} noValidate>
          <p className="join-form__explain">{t('joinExplain')}</p>
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
            label={t('choosePassword')}
            name="new-password"
            autoComplete="new-password"
            enterKeyHint="next"
            value={password}
            onChange={(v) => {
              setPassword(v)
              if (error) setError(null)
            }}
            shown={shown}
            onShownChange={setShown}
            describedBy="join-rules"
            error={error?.key === 'errWeakPassword'}
          />
          <PasswordField
            label={t('confirmPassword')}
            name="confirm-password"
            autoComplete="new-password"
            enterKeyHint="go"
            value={confirm}
            onChange={(v) => {
              setConfirm(v)
              if (error) setError(null)
            }}
            shown={shown}
            noToggle
            describedBy="join-rules"
            error={confirm.length > 0 && password.length > 0 && !check.matches && confirm.length >= password.length}
          />
          <PasswordRules id="join-rules" check={check} />
          {error ? <FormError>{t(error.key, authErrorVars(error))}</FormError> : null}
          <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={!check.ok} iconRight="arrow-right">
            {busy ? t('joining') : t('joinCta')}
          </Button>
        </form>
      </section>
    </AuthScreen>
  )
}
