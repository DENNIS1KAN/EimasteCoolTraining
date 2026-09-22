import { useState } from 'react'
import { useT } from '../../i18n'
import { flushNow, getState, refresh, useStore, useSync } from '../../data/store'
import { BrandMark } from '../../app/Brand'
import { fmtRelative } from '../../lib/format'
import { Button, Icon, toast } from '../../ui'
import { SETUP_GUIDE_URL } from '../auth/messages'
import { SETTINGS } from './messages'
import { Section } from './Section'
import { APP_VERSION } from './version'

/** Version, mode, sync status (shared mode) and the setup guide. */
export function AboutSection() {
  const t = useT(SETTINGS)
  const demo = useStore((s) => s.backend) === 'demo'
  const sync = useSync()
  const [busy, setBusy] = useState(false)

  const syncNow = async () => {
    setBusy(true)
    try {
      await flushNow()
      await refresh()
    } finally {
      setBusy(false)
    }
    const s = getState().sync
    toast(s.pending ? t('pending', { n: s.pending }) : s.online ? t('syncDone') : t('offline'), { tone: s.pending || !s.online ? 'default' : 'good' })
  }

  const status = !sync.online
    ? { tone: 'warn', text: t('offline') }
    : sync.pending
      ? { tone: 'warn', text: sync.pending === 1 ? t('pendingOne') : t('pending', { n: sync.pending }) }
      : { tone: 'good', text: t('allSaved') }

  return (
    <Section id="about" icon="info" title={t('about')}>
      <dl className="set-dl">
        <div>
          <dt>{t('version')}</dt>
          <dd className="num set-dl__num">{APP_VERSION}</dd>
        </div>
        <div>
          <dt>{t('mode')}</dt>
          <dd>{demo ? t('modeDemo') : t('modeShared')}</dd>
        </div>
        {demo ? null : (
          <>
            <div>
              <dt>{t('sync')}</dt>
              <dd>
                <span className={`set-dot set-dot--${status.tone}`} aria-hidden="true" />
                {status.text}
              </dd>
            </div>
            <div>
              <dt>{t('lastSync')}</dt>
              <dd>{sync.lastSyncAt ? fmtRelative(sync.lastSyncAt) : t('never')}</dd>
            </div>
          </>
        )}
      </dl>
      {!demo && sync.error ? <p className="set-warn">{sync.error}</p> : null}
      <div className="set-about__actions">
        {demo ? null : (
          <Button variant="secondary" size="sm" icon="refresh" loading={busy} onClick={() => void syncNow()}>
            {t('syncNow')}
          </Button>
        )}
        <a className="set-link" href={SETUP_GUIDE_URL} target="_blank" rel="noreferrer">
          <Icon name="file" size={16} />
          {t('setupGuide')}
          <Icon name="external" size={14} />
        </a>
      </div>
      <p className="set-made">
        <BrandMark size={28} />
        <span>{t('madeFor')}</span>
      </p>
    </Section>
  )
}
