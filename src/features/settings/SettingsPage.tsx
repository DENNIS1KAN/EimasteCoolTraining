import { useT } from '../../i18n'
import { COMMON } from '../../i18n/common'
import { useMe, useStore } from '../../data/store'
import { PageHeader } from '../../ui'
import { InstallGuide } from '../auth/InstallGuide'
import '../auth/install'
import { AboutSection } from './AboutSection'
import { AccountSection } from './AccountSection'
import { AppearanceSection } from './AppearanceSection'
import { DataSection } from './DataSection'
import { DemoSection } from './DemoSection'
import { JumpNav } from './JumpNav'
import { SETTINGS } from './messages'
import { PrivacySection } from './PrivacySection'
import { ProfileSection } from './ProfileSection'
import { Section } from './Section'
import { UnitsSection } from './UnitsSection'
import { WorkoutSection } from './WorkoutSection'
import './settings.css'

/** /settings: profile, units, weight privacy, appearance, workout prefs, account, data, install, about. */
export default function SettingsPage() {
  const t = useT(SETTINGS)
  const c = useT(COMMON)
  const me = useMe()
  const demo = useStore((s) => s.backend) === 'demo'
  if (!me) return null
  return (
    <div className="settings">
      <PageHeader eyebrow={`${me.name} · ${me.role === 'coach' ? c('coach') : c('athlete')}`} title={t('title')} />
      <JumpNav demo={demo} />
      <div className="settings__grid">
        <div className="settings__col">
          <ProfileSection me={me} />
          <UnitsSection me={me} />
          <PrivacySection me={me} />
          <AppearanceSection />
          <WorkoutSection />
        </div>
        <div className="settings__col">
          <AccountSection me={me} />
          <DataSection me={me} />
          <Section id="install" icon="download" title={t('install')}>
            <InstallGuide compact />
          </Section>
          <AboutSection />
          {demo ? <DemoSection /> : null}
        </div>
      </div>
    </div>
  )
}
