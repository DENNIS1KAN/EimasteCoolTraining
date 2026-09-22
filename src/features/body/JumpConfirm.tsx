import { useState } from 'react'
import type { Unit, WeightEntry } from '../../data/types'
import { useT } from '../../i18n'
import type { ISODate } from '../../lib/dates'
import { fmtDayLabel } from '../../lib/format'
import { ConfirmSheet } from '../../ui'
import { wAbs, wText } from './format'
import { bigJumpKg } from './logic'
import { M } from './messages'

interface Pending {
  kg: number
  diffKg: number
  ref: WeightEntry
  run: () => void
}

/**
 * "Is the number right?" before saving a weigh-in that is far from the nearest one (a typo like 38,3 for 83,8 would
 * otherwise flow into the trend, the goal, the feed and the league). Small changes save straight away.
 * Returns `guard(kg, date, ref, save)` and the confirm sheet to render.
 */
export function useJumpConfirm(unit: Unit) {
  const t = useT(M)
  const [pending, setPending] = useState<Pending | null>(null)
  // Kept apart from `pending` so the sheet keeps its text during the exit animation.
  const [open, setOpen] = useState(false)

  const guard = (kg: number, date: ISODate, ref: WeightEntry | null, save: () => void) => {
    const diffKg = bigJumpKg(kg, date, ref)
    if (diffKg == null || !ref) {
      save()
      return
    }
    setPending({ kg, diffKg, ref, run: save })
    setOpen(true)
  }

  const sheet = (
    <ConfirmSheet
      open={open}
      title={pending ? t('jumpTitle', { value: wText(pending.kg, unit) }) : ''}
      body={
        pending
          ? t(pending.diffKg > 0 ? 'jumpBodyUp' : 'jumpBodyDown', {
              diff: wAbs(pending.diffKg, unit),
              prev: wText(pending.ref.kg, unit),
              when: fmtDayLabel(pending.ref.date),
            })
          : null
      }
      confirmLabel={t('jumpConfirm')}
      cancelLabel={t('jumpFix')}
      onConfirm={() => pending?.run()}
      onClose={() => setOpen(false)}
    />
  )
  return { guard, sheet }
}
