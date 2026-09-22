import { setLang, useLang, useT, type Lang } from '../../i18n'
import { AUTH } from './messages'

const OPTIONS: { value: Lang; label: string; name: string }[] = [
  { value: 'en', label: 'EN', name: 'English' },
  { value: 'el', label: 'ΕΛ', name: 'Ελληνικά' },
]

/** Compact EN / ΕΛ switch for the signed-out screens (corner of the splash). */
export function LangToggle() {
  const t = useT(AUTH)
  const lang = useLang()
  return (
    <div className="auth-lang" role="group" aria-label={t('language')}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.value}
          className="auth-lang__opt"
          aria-pressed={lang === o.value}
          aria-label={o.name}
          onClick={() => setLang(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
