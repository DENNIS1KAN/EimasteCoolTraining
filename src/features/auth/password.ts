/** Supabase's default minimum; the app asks for the same so the server never has to refuse. */
export const MIN_PASSWORD = 6

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
