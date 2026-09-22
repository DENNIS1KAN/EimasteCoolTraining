import { defineMessages, useT } from '../i18n'
import { useStore } from '../data/store'
import { Button } from '../ui'
import { BrandMark } from './Brand'
import './AppShell.css'

const M = defineMessages(
  {
    loading: 'Loading Eimaste Cool Training',
    loadingShort: 'Loading…',
    title: 'Couldn’t start',
    body: 'Something went wrong while opening the app. Check your connection and try again. If it keeps happening, tell your coach.',
    retry: 'Try again',
    details: 'Details',
  },
  {
    loading: 'Φόρτωση του Eimaste Cool Training',
    loadingShort: 'Φόρτωση…',
    title: 'Δεν ξεκίνησε',
    body: 'Κάτι πήγε στραβά στο άνοιγμα της εφαρμογής. Έλεγξε τη σύνδεσή σου και ξαναδοκίμασε. Αν συνεχίσει, ενημέρωσε τον προπονητή σου.',
    retry: 'Ξαναδοκίμασε',
    details: 'Λεπτομέρειες',
  },
)

/**
 * First paint while the backend boots: the brand mark breathing on --bg.
 * `quiet` (route chunks loading): an empty screen that only shows a small spinner after 300 ms.
 */
export function BootScreen({ quiet }: { quiet?: boolean }) {
  const t = useT(M)
  if (quiet) {
    return (
      <div className="boot boot--quiet" aria-busy="true">
        <span className="boot__spinner" role="status">
          <span className="boot-ring" aria-hidden="true" />
          <span className="visually-hidden">{t('loadingShort')}</span>
        </span>
      </div>
    )
  }
  return (
    <div className="boot" aria-busy="true" role="status">
      <span className="boot__mark">
        <BrandMark size={72} />
      </span>
      <span className="visually-hidden">{t('loading')}</span>
    </div>
  )
}

/** In-content placeholder while a page's code loads (the tab bar stays put). Spinner appears after 300 ms. */
export function PageFallback() {
  const t = useT(M)
  return (
    <div className="app-page-fallback" aria-busy="true">
      <span className="boot__spinner" role="status">
        <span className="boot-ring" aria-hidden="true" />
        <span className="visually-hidden">{t('loadingShort')}</span>
      </span>
    </div>
  )
}

/** Boot failed (e.g. no network on first launch, bad config). Shows state.bootError and offers a reload. */
export function ErrorScreen() {
  const t = useT(M)
  const err = useStore((s) => s.bootError)
  return (
    <div className="boot boot--error" role="alert">
      <div className="boot__card">
        <BrandMark size={56} />
        <h1 className="boot__title">{t('title')}</h1>
        <p className="boot__body">{t('body')}</p>
        {err ? (
          <p className="boot__detail">
            <span className="visually-hidden">{t('details')}: </span>
            {err}
          </p>
        ) : null}
        <div className="boot__actions">
          <Button variant="primary" size="lg" icon="refresh" block onClick={() => location.reload()}>
            {t('retry')}
          </Button>
        </div>
      </div>
    </div>
  )
}
