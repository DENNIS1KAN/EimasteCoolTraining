import { useEffect, useState } from 'react'
import type { Member } from '../../data/types'
import { COMMON } from '../../i18n/common'
import { useT } from '../../i18n'
import { fmtNum } from '../../lib/format'
import { parseNum } from '../../lib/units'
import { Button, NumberField, Sheet, toast } from '../../ui'
import { setGoalWeight } from './actions'
import { fromDisplay, phaseOf, toDisplay, validWeight, WEIGHT_LIMITS } from './logic'
import { M } from './messages'
import { wAbs } from './format'

/** Set, change or remove a member's goal weight (typed in their unit, stored in kg). */
export function GoalSheet({ open, onClose, member, currentKg }: { open: boolean; onClose: () => void; member: Member; currentKg: number | null }) {
  const t = useT(M)
  const tc = useT(COMMON)
  const unit = member.settings.unit
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    const g = member.goalWeightKg
    setValue(g != null ? fmtNum(toDisplay(g, unit), 1, 1) : '')
    setTouched(false)
  }, [open, member.goalWeightKg, unit])

  const v = parseNum(value)
  const valid = validWeight(v, unit)
  const goalKg = valid ? fromDisplay(v, unit) : null
  const phase = currentKg != null && goalKg != null ? phaseOf(currentKg, goalKg) : null
  const lim = WEIGHT_LIMITS[unit]
  const error = touched && value.trim() && !valid ? t('invalidWeight', { min: `${lim.min} ${unit}`, max: `${lim.max} ${unit}` }) : undefined
  const hint = phase && currentKg != null && goalKg != null ? t(`phaseHint_${phase}`, { value: wAbs(goalKg - currentKg, unit) }) : undefined

  const save = () => {
    setTouched(true)
    if (goalKg == null) return
    setGoalWeight(member.id, goalKg)
    toast(t('goalSaved'), { tone: 'good' })
    onClose()
  }
  const clear = () => {
    setGoalWeight(member.id, null)
    toast(t('goalRemoved'))
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('goalSheetTitle')}
      subtitle={t('goalSheetSub')}
      footer={
        <div className="body-sheet__footer">
          {member.goalWeightKg != null && (
            <Button variant="ghost" onClick={clear}>
              {t('removeGoal')}
            </Button>
          )}
          <Button variant="primary" block onClick={save} disabled={!valid}>
            {tc('save')}
          </Button>
        </div>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <NumberField
          label={t('goalLabel')}
          value={value}
          onChange={(s) => setValue(s)}
          onBlur={() => setTouched(true)}
          decimals={1}
          min={lim.min}
          max={lim.max}
          suffix={unit}
          hint={error ? undefined : hint}
          error={error}
          autoFocus
        />
      </form>
    </Sheet>
  )
}
