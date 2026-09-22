/**
 * Minimum password length for joining and changing a password. Stricter than Supabase's default of 6: the
 * login handles are public (the profile picker lists them), so a short password is the only thing to guess.
 */
export const MIN_PASSWORD = 8

/** Values for the password messages ("At least {min} characters"). */
export const PASSWORD_VARS = { min: MIN_PASSWORD } as const

export interface PasswordCheck {
  longEnough: boolean
  /** Both fields filled in and equal. */
  matches: boolean
  /** Ready to submit. */
  ok: boolean
}

export function checkPassword(password: string, confirm: string): PasswordCheck {
  const longEnough = password.length >= MIN_PASSWORD
  const matches = confirm.length > 0 && password === confirm
  return { longEnough, matches, ok: longEnough && matches }
}
