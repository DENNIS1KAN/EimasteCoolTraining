import { BackendError, type BackendErrorCode } from '../../data/backend/types'

/** Message keys (in AUTH_MESSAGES) for the errors the sign-in, join and password forms can show. */
export type AuthErrorKey =
  | 'errWrongPassword'
  | 'errOffline'
  | 'errNotFound'
  | 'errGeneric'
  | 'errInvalidInvite'
  | 'errAlreadyJoined'
  | 'errConflict'
  | 'errWeakPassword'
  | 'errEmailConfirmation'
  | 'errInviteStarted'
  | 'errSessionExpired'

export type AuthContext = 'login' | 'join' | 'password'

const codeOf = (e: unknown): BackendErrorCode | null => (e instanceof BackendError ? e.code : null)

/**
 * Map an error thrown by the backend to a friendly message key for the form it happened in.
 * Anything unexpected (including non-BackendErrors) becomes a generic "try again", or "you're offline"
 * when the browser says so.
 */
export function authErrorKey(e: unknown, ctx: AuthContext, online = typeof navigator === 'undefined' || navigator.onLine !== false): AuthErrorKey {
  const code = codeOf(e)
  if (code === 'network' || (!online && code !== 'auth')) return 'errOffline'
  if (ctx === 'login') {
    if (code === 'auth') return 'errWrongPassword'
    if (code === 'not_found') return 'errNotFound'
    if (code === 'email_confirmation_on') return 'errEmailConfirmation'
    return 'errGeneric'
  }
  if (ctx === 'join') {
    switch (code) {
      case 'invalid_invite':
      case 'not_found':
        return 'errInvalidInvite'
      case 'already_joined':
        return 'errAlreadyJoined'
      case 'conflict':
        return 'errConflict'
      case 'weak_password':
        return 'errWeakPassword'
      case 'email_confirmation_on':
        return 'errEmailConfirmation'
      case 'auth':
        return 'errInviteStarted'
      default:
        return 'errGeneric'
    }
  }
  if (code === 'weak_password') return 'errWeakPassword'
  if (code === 'auth') return 'errSessionExpired'
  return 'errGeneric'
}

/** Join errors that end the flow (the form cannot fix them): the page swaps to a dead-end card. */
export const isFatalJoinError = (k: AuthErrorKey): boolean => k === 'errInvalidInvite' || k === 'errAlreadyJoined' || k === 'errConflict'
