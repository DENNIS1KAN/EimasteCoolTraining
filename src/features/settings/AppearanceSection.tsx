import { useT } from '../../i18n'
import { setThemePref, useThemePref, type ThemePref } from '../../app/theme'
import { Segmented } from '../../ui'
import { SETTINGS } from './messages'
import { Section } from './Section'

/** Theme (System / Light / Dark). Per device. */
export function AppearanceSection() {
  const t = useT(SETTINGS)
  const theme = useThemePref()
  return (
    <Section id="appearance" icon="sun" title={t('appearance')}>
      <div className="set-field">
        <p className="set-label" id="settings-theme">
          {t('theme')}
        </p>
        <Segmented<ThemePref>
          block
          ariaLabel={t('theme')}
          value={theme}
          onChange={setThemePref}
          options={[
            { value: 'system', label: t('system'), icon: 'monitor' },
            { value: 'light', label: t('light'), icon: 'sun' },
            { value: 'dark', label: t('dark'), icon: 'moon' },
          ]}
        />
      </div>
    </Section>
  )
}
