import { useMemo, useState } from 'react'
import { useT } from '../../i18n'
import { Button, Icon, toast, type IconName } from '../../ui'
import { currentPlatform, isIosOtherBrowser, promptInstall, useInstall, type InstallPlatform } from './install'
import { AUTH, type AuthKey } from './messages'
import './install.css'

interface Guide {
  platform: InstallPlatform
  title: AuthKey
  icon: IconName
  steps: { text: AuthKey; icon?: IconName }[]
}

const GUIDES: Guide[] = [
  {
    platform: 'ios',
    title: 'installIos',
    icon: 'share',
    steps: [{ text: 'installIos1', icon: 'share' }, { text: 'installIos2', icon: 'plus-circle' }, { text: 'installIos3' }],
  },
  {
    platform: 'android',
    title: 'installAndroid',
    icon: 'more',
    steps: [{ text: 'installAndroid1', icon: 'more' }, { text: 'installAndroid2', icon: 'download' }, { text: 'installAndroid3' }],
  },
  {
    platform: 'desktop',
    title: 'installDesktop',
    icon: 'monitor',
    steps: [
      { text: 'installDesktop1', icon: 'download' },
      { text: 'installDesktop2', icon: 'more' },
    ],
  },
]

function Steps({ guide }: { guide: Guide }) {
  const t = useT(AUTH)
  return (
    <ol className="install__steps">
      {guide.steps.map((s, i) => (
        <li key={s.text} className="install__step">
          <span className="install__num num" aria-hidden="true">
            {i + 1}
          </span>
          <span className="install__text">{t(s.text)}</span>
          {s.icon ? (
            <span className="install__glyph" aria-hidden="true">
              <Icon name={s.icon} size={16} />
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

/**
 * "Add to Home Screen" help: the install button when the browser offers one, the steps for this device
 * first, and the other platforms behind a disclosure. Shows a success row once installed.
 */
export function InstallGuide({ compact }: { compact?: boolean }) {
  const t = useT(AUTH)
  const { canPrompt, installed } = useInstall()
  const [busy, setBusy] = useState(false)
  const platform = useMemo(currentPlatform, [])
  const iosOther = useMemo(() => platform === 'ios' && typeof navigator !== 'undefined' && isIosOtherBrowser(navigator.userAgent), [platform])
  const mine = GUIDES.find((g) => g.platform === platform) ?? GUIDES[2]
  const others = GUIDES.filter((g) => g !== mine)

  if (installed) {
    return (
      <div className="install install--done">
        <span className="install__ok" aria-hidden="true">
          <Icon name="check" size={18} strokeWidth={2.4} />
        </span>
        <div>
          <p className="install__title">{t('installedTitle')}</p>
          <p className="install__sub">{t('installedBody')}</p>
        </div>
      </div>
    )
  }

  const install = async () => {
    setBusy(true)
    const r = await promptInstall()
    setBusy(false)
    if (r === 'accepted') toast(t('installedTitle'), { tone: 'good' })
  }

  return (
    <div className={['install', compact && 'install--compact'].filter(Boolean).join(' ')}>
      {canPrompt ? (
        <Button variant="primary" icon="download" block loading={busy} onClick={install}>
          {t('installNow')}
        </Button>
      ) : null}
      <div className="install__block">
        <p className="install__platform">
          <Icon name={mine.icon} size={16} />
          {t(mine.title)}
        </p>
        {iosOther ? <p className="install__note">{t('installIosOther')}</p> : null}
        <Steps guide={mine} />
      </div>
      <details className="install__more">
        <summary>
          <span>{t('otherDevices')}</span>
          <Icon name="chevron-down" size={16} className="install__chev" />
        </summary>
        {others.map((g) => (
          <div key={g.platform} className="install__block">
            <p className="install__platform">
              <Icon name={g.icon} size={16} />
              {t(g.title)}
            </p>
            <Steps guide={g} />
          </div>
        ))}
      </details>
    </div>
  )
}
