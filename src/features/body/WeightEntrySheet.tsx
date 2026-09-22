import { useState } from 'react'
import { useStore } from '../../data/store'
import type { Unit, WeightEntry } from '../../data/types'
import { COMMON } from '../../i18n/common'
import { useT } from '../../i18n'
import { todayISO } from '../../lib/dates'
import { fmtDayLabel, fmtNum } from '../../lib/format'
import { dailyId } from '../../lib/ids'
import { parseNum } from '../../lib/units'
import { Banner, Button, ConfirmSheet, DateField, Icon, NumberField, Sheet, Stepper, TextField, toast } from '../../ui'
import { deleteWeighIn, saveWeighIn } from './actions'
import { fromDisplay, round1, toDisplay, WEIGHT_LIMITS } from './logic'
import { M } from './messages'
import { wText } from './format'

export interface WeightEntrySheetProps {
  open: boolean
  onClose: () => void
  memberId: string
  unit: Unit
  /** The weigh-in being edited; omit to log a new one. */
  entry?: WeightEntry | null
  /** Starting value for a new weigh-in, in the display unit. */
  startValue: number
  /** Called after a successful save with the stored row's kg (for streak/celebration feedback). */
  onSaved?: (kg: number, date: string) => void
}

interface Draft {
  date: string
  value: number
  bodyFat: string
  waist: string
  note: string
}

const draftFor = (entry: WeightEntry | null | undefined, startValue: number, unit: Unit): Draft => ({
  date: entry?.date ?? todayISO(),
  value: entry ? toDisplay(entry.kg, unit) : round1(startValue),
  bodyFat: entry?.bodyFat != null ? String(entry.bodyFat) : '',
  waist: entry?.waistCm != null ? String(entry.waistCm) : '',
  note: entry?.note ?? '',
})

const hasExtras = (e: WeightEntry | null | undefined) => !!e && (e.bodyFat != null || e.waistCm != null || !!e.note)

/** Log or edit a weigh-in: stepper (typeable), date, and optional body fat / waist / note. Editing can delete. */
export function WeightEntrySheet(props: WeightEntrySheetProps) {
  const { open, onClose, entry } = props
  const t = useT(M)
  const tc = useT(COMMON)
  const [draft, setDraft] = useState<Draft>(() => draftFor(entry, props.startValue, props.unit))
  const [confirm, setConfirm] = useState(false)
  // Re-seed the form every time the sheet opens (derived-state pattern: no effect, no flash of stale values).
  const [wasOpen, setWasOpen] = useState(open)
  const [moreOpen, setMoreOpen] = useState(() => hasExtras(entry))
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(draftFor(entry, props.startValue, props.unit))
      setMoreOpen(hasExtras(entry))
    }
  }

  // Select the table, not a row: the selector would close over draft.date, and useStore caches by state identity.
  const weights = useStore((s) => s.weights)
  const existing = weights[dailyId(props.memberId, draft.date)] ?? null
  const conflict = existing && existing.id !== entry?.id ? existing : null
  const lim = WEIGHT_LIMITS[props.unit]
  const today = todayISO()
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const save = () => {
    const kg = fromDisplay(draft.value, props.unit)
    const undo = saveWeighIn(
      {
        memberId: props.memberId,
        date: draft.date,
        kg,
        bodyFat: parseNum(draft.bodyFat),
        waistCm: parseNum(draft.waist),
        note: draft.note,
      },
      entry?.id ?? null,
    )
    toast(entry ? t('updatedToast') : t('savedToast', { value: wText(kg, props.unit) }), {
      tone: 'good',
      action: { label: t('undo'), onClick: undo },
    })
    props.onSaved?.(kg, draft.date)
    onClose()
  }

  const doDelete = () => {
    if (!entry) return
    const undo = deleteWeighIn(entry.id)
    toast(t('deleted'), { action: { label: t('undo'), onClick: undo } })
    onClose()
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={entry ? t('editEntry') : t('logWeight')}
        subtitle={fmtDayLabel(draft.date)}
        footer={
          <div className="body-sheet__footer">
            {entry && (
              <Button variant="ghost" icon="trash" onClick={() => setConfirm(true)} aria-label={t('deleteEntry')}>
                {tc('delete')}
              </Button>
            )}
            <Button variant="primary" block icon="check" onClick={save}>
              {entry ? tc('save') : t('saveWeight')}
            </Button>
          </div>
        }
      >
        <form
          className="stack-lg"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div className="body-entry__stepper">
            <Stepper
              value={draft.value}
              onChange={(v) => set({ value: v })}
              step={0.1}
              min={lim.min}
              max={lim.max}
              format={(n) => fmtNum(n, 1, 1)}
              unit={props.unit}
              size="lg"
              label={t('weightLabel')}
            />
          </div>
          <DateField label={t('date')} value={draft.date} max={today} onChange={(v) => v && set({ date: v })} />
          {conflict && (
            <Banner tone="warn" role="status">
              {t('replaceWarn', { value: wText(conflict.kg, props.unit) })}
            </Banner>
          )}
          <details className="body-entry__more" open={moreOpen || undefined}>
            <summary>
              <Icon name="plus-circle" size={18} />
              <span>{t('more')}</span>
              <Icon name="chevron-down" size={18} className="body-entry__chev" />
            </summary>
            <div className="body-entry__more-body">
              <div className="grid-2">
                <NumberField
                  label={t('bodyFat')}
                  value={draft.bodyFat}
                  onChange={(v) => set({ bodyFat: v })}
                  decimals={1}
                  min={2}
                  max={70}
                  suffix="%"
                />
                <NumberField label={t('waist')} value={draft.waist} onChange={(v) => set({ waist: v })} decimals={1} min={40} max={200} suffix="cm" />
              </div>
              <TextField
                label={t('note')}
                value={draft.note}
                placeholder={t('notePh')}
                maxLength={140}
                onChange={(e) => set({ note: e.target.value })}
              />
            </div>
          </details>
          <button type="submit" hidden />
        </form>
      </Sheet>
      {entry && (
        <ConfirmSheet
          open={confirm}
          title={t('deleteTitle')}
          body={t('deleteBody', { value: wText(entry.kg, props.unit), date: fmtDayLabel(entry.date) })}
          confirmLabel={tc('delete')}
          danger
          onConfirm={doDelete}
          onClose={() => setConfirm(false)}
        />
      )}
    </>
  )
}
