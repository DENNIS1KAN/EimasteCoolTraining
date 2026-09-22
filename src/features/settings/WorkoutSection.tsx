import { useT } from '../../i18n'
import { setPref, usePrefs } from '../../lib/prefs'
import { Switch } from '../../ui'
import { SETTINGS } from './messages'
import { Section } from './Section'

/** Rest timer sound / vibration and keep-awake: device preferences (src/lib/prefs). */
export function WorkoutSection() {
  const t = useT(SETTINGS)
  const prefs = usePrefs()
  return (
    <Section id="workout" icon="timer" title={t('workout')} sub={t('workoutSub')}>
      <div className="set-switches">
        <Switch checked={prefs.restSound} onChange={(v) => setPref('restSound', v)} label={t('restSound')} description={t('restSoundBody')} />
        <Switch checked={prefs.restVibrate} onChange={(v) => setPref('restVibrate', v)} label={t('restVibrate')} description={t('restVibrateBody')} />
        <Switch checked={prefs.keepAwake} onChange={(v) => setPref('keepAwake', v)} label={t('keepAwake')} description={t('keepAwakeBody')} />
      </div>
    </Section>
  )
}
