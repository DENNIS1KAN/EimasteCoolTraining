import { useMe } from '../../data/store'
import { useT } from '../../i18n'
import { useWeightModel } from './hooks'
import { stepperStart } from './logic'
import { M } from './messages'
import { celebrateStreak } from './QuickLogDock'
import { WeightEntrySheet } from './WeightEntrySheet'
import './body.css'

/**
 * Log the viewer's weight from anywhere (Home, Squad…): the same stepper UX as the Body dock.
 * If today is already logged, it opens that weigh-in for editing.
 */
export function LogWeightSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT(M)
  const me = useMe()
  const model = useWeightModel(me)
  if (!me) return <></>
  const unit = me.settings.unit
  const todayEntry = model.entries.find((e) => e.date === model.today) ?? null
  return (
    <WeightEntrySheet
      open={open}
      onClose={onClose}
      memberId={me.id}
      unit={unit}
      entry={todayEntry}
      startValue={stepperStart(model.latest?.kg, unit)}
      onSaved={(_kg, date) => celebrateStreak(model.entries, me.id, date, model.today, (n) => t('streak', { n }))}
    />
  )
}
