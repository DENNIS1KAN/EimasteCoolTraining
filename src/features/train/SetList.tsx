import type { ReactNode } from 'react'
import type { Unit } from '../../data/types'
import { useT } from '../../i18n'
import { M } from './messages'

/** Column header (SET · KG · REPS) above the set rows. */
export function SetList({ unit, children }: { unit: Unit; children: ReactNode }) {
  const t = useT(M)
  return (
    <div className="tr-sets">
      <div className="tr-sets__h" aria-hidden="true">
        <span>{t('colSet')}</span>
        <span>{unit}</span>
        <span>{t('colReps')}</span>
        <span />
      </div>
      {children}
    </div>
  )
}
