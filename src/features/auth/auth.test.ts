import { afterEach, describe, expect, it } from 'vitest'
import { BackendError } from '../../data/backend/types'
import { authError, authErrorKey, isFatalJoinError } from './errors'
import { translate } from '../../i18n'
import { AUTH } from './messages'
import { checkPassword, MIN_PASSWORD, PASSWORD_VARS } from './password'
import { getLastProfile, setLastProfile } from './lastProfile'
import { detectPlatform, isIosOtherBrowser } from './install'

const err = (code: ConstructorParameters<typeof BackendError>[0]) => new BackendError(code)

describe('authErrorKey', () => {
  it('maps sign-in errors', () => {
    expect(authErrorKey(err('auth'), 'login', true)).toBe('errWrongPassword')
    expect(authErrorKey(err('network'), 'login', true)).toBe('errOffline')
    expect(authErrorKey(err('not_found'), 'login', true)).toBe('errNotFound')
    expect(authErrorKey(err('forbidden'), 'login', true)).toBe('errGeneric')
    expect(authErrorKey(new TypeError('boom'), 'login', true)).toBe('errGeneric')
  })

  it('says offline when the browser is offline, but keeps a wrong password a wrong password', () => {
    expect(authErrorKey(new TypeError('Failed to fetch'), 'login', false)).toBe('errOffline')
    expect(authErrorKey(err('unknown'), 'join', false)).toBe('errOffline')
    expect(authErrorKey(err('auth'), 'login', false)).toBe('errWrongPassword')
  })

  it('maps join errors', () => {
    expect(authErrorKey(err('invalid_invite'), 'join', true)).toBe('errInvalidInvite')
    expect(authErrorKey(err('not_found'), 'join', true)).toBe('errInvalidInvite')
    expect(authErrorKey(err('already_joined'), 'join', true)).toBe('errAlreadyJoined')
    expect(authErrorKey(err('conflict'), 'join', true)).toBe('errConflict')
    expect(authErrorKey(err('weak_password'), 'join', true)).toBe('errWeakPassword')
    expect(authErrorKey(err('email_confirmation_on'), 'join', true)).toBe('errEmailConfirmation')
    expect(authErrorKey(err('auth'), 'join', true)).toBe('errInviteStarted')
    expect(authErrorKey(err('network'), 'join', true)).toBe('errOffline')
    expect(authErrorKey(err('too_large'), 'join', true)).toBe('errGeneric')
  })

  it('maps password-change errors', () => {
    expect(authErrorKey(err('weak_password'), 'password', true)).toBe('errPasswordRejected')
    expect(authErrorKey(err('auth'), 'password', true)).toBe('errSessionExpired')
    expect(authErrorKey(err('network'), 'password', true)).toBe('errOffline')
    expect(authErrorKey(err('forbidden'), 'password', true)).toBe('errGeneric')
  })

  it('maps rate limits, a busy server and configuration problems in every form', () => {
    for (const ctx of ['login', 'join', 'password'] as const) {
      expect(authErrorKey(err('rate_limited'), ctx, true)).toBe('errRateLimited')
      expect(authErrorKey(err('unavailable'), ctx, true)).toBe('errUnavailable')
      expect(authErrorKey(err('config'), ctx, false)).toBe('errConfig')
    }
    expect(authError(new BackendError('config', 'Use the anon key in config.js'), 'login', true)).toEqual({ key: 'errConfig', detail: 'Use the anon key in config.js' })
    expect(authError(err('auth'), 'login', true)).toEqual({ key: 'errWrongPassword' })
  })

  it('knows which join errors end the flow', () => {
    expect(isFatalJoinError('errInvalidInvite')).toBe(true)
    expect(isFatalJoinError('errAlreadyJoined')).toBe(true)
    expect(isFatalJoinError('errConflict')).toBe(true)
    expect(isFatalJoinError('errWeakPassword')).toBe(false)
    expect(isFatalJoinError('errOffline')).toBe(false)
    expect(isFatalJoinError('errEmailConfirmation')).toBe(false)
  })
})

describe('checkPassword', () => {
  it('needs 8+ characters and a matching confirmation', () => {
    expect(MIN_PASSWORD).toBe(8)
    expect(checkPassword('', '')).toEqual({ longEnough: false, matches: false, ok: false })
    expect(checkPassword('1234567', '1234567')).toEqual({ longEnough: false, matches: true, ok: false })
    expect(checkPassword('12345678', '')).toEqual({ longEnough: true, matches: false, ok: false })
    expect(checkPassword('12345678', '12345679')).toEqual({ longEnough: true, matches: false, ok: false })
    expect(checkPassword('12345678', '12345678')).toEqual({ longEnough: true, matches: true, ok: true })
    expect(checkPassword('καλημέρα', 'καλημέρα').ok).toBe(true)
  })

  it('puts the minimum into every password message', () => {
    for (const lang of ['en', 'el'] as const)
      for (const k of ['ruleLength', 'errWeakPassword', 'errPasswordRejected'] as const) {
        expect(AUTH[lang][k], `${lang}.${k}`).toContain('{min}')
        expect(translate(AUTH, k, PASSWORD_VARS, lang)).toContain('8')
      }
  })
})

describe('last profile', () => {
  afterEach(() => localStorage.clear())
  it('remembers the last picked profile on this device', () => {
    expect(getLastProfile()).toBeNull()
    setLastProfile('stelios')
    expect(getLastProfile()).toBe('stelios')
    setLastProfile(null)
    expect(getLastProfile()).toBeNull()
  })
})

describe('detectPlatform', () => {
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
  const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
  const CHROME_IOS =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1'

  it('recognises iPhone, iPad (desktop UA + touch), Android and desktop', () => {
    expect(detectPlatform(IPHONE)).toBe('ios')
    expect(detectPlatform(IPAD, 5)).toBe('ios')
    expect(detectPlatform(IPAD, 0)).toBe('desktop')
    expect(detectPlatform(ANDROID)).toBe('android')
    expect(detectPlatform(WIN)).toBe('desktop')
  })

  it('spots other browsers on iOS', () => {
    expect(isIosOtherBrowser(CHROME_IOS)).toBe(true)
    expect(isIosOtherBrowser(IPHONE)).toBe(false)
  })
})
