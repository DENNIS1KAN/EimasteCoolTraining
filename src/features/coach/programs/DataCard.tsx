import { useState } from 'react'
import { Button, Card, CardHeader, Icon, Select, toast } from '../../../ui'
import { useT } from '../../../i18n'
import { getState } from '../../../data/store'
import type { Member } from '../../../data/types'
import { todayISO } from '../../../lib/dates'
import { downloadText } from '../lib/download'
import { backupJSON, exportFileName, workoutsCSV } from '../lib/exportData'
import { M } from '../messages'

const ALL = '*'

/** "Your data": a JSON backup of every table, and workouts as CSV (everyone or one member). */
export function DataCard({ members }: { members: Member[] }) {
  const t = useT(M)
  const [whose, setWhose] = useState(ALL)

  const backup = () => {
    const file = exportFileName('backup', todayISO(), 'json')
    // read the tables at click time: no need to re-render this card on every change
    downloadText(file, backupJSON(getState()), 'application/json')
    toast(t('downloaded', { file }), { tone: 'good' })
  }

  const exportWorkouts = () => {
    const s = getState()
    const who = whose === ALL ? members : members.filter((m) => m.id === whose)
    const file = exportFileName(whose === ALL ? 'workouts' : `workouts-${who[0]?.slug ?? 'member'}`, todayISO(), 'csv')
    downloadText(file, workoutsCSV(Object.values(s.logs), s.programs, who, { bom: true }), 'text/csv;charset=utf-8')
    toast(t('downloaded', { file }), { tone: 'good' })
  }

  return (
    <Card as="section" className="data-card" aria-labelledby="coach-data-title">
      <CardHeader title={<span id="coach-data-title">{t('dataTitle')}</span>} subtitle={t('dataBody')} />
      <div className="data-card__item">
        <span className="data-card__icon" aria-hidden="true">
          <Icon name="cloud" size={20} />
        </span>
        <div className="data-card__text">
          <p className="data-card__title">{t('backup')}</p>
          <p className="data-card__hint">{t('backupHint')}</p>
          <div className="data-card__controls">
            <Button variant="secondary" size="md" icon="download" onClick={backup}>
              {t('downloadBackup')}
            </Button>
          </div>
        </div>
      </div>
      <div className="data-card__item">
        <span className="data-card__icon" aria-hidden="true">
          <Icon name="train" size={20} />
        </span>
        <div className="data-card__text">
          <p className="data-card__title">{t('exportWorkouts')}</p>
          <p className="data-card__hint">{t('exportWorkoutsHint')}</p>
          <div className="data-card__controls">
            <Select
              label={t('whose')}
              options={[{ value: ALL, label: t('everyone') }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
              value={whose}
              onChange={setWhose}
            />
            <Button variant="secondary" size="md" icon="download" onClick={exportWorkouts} aria-label={t('exportWorkouts')}>
              CSV
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
