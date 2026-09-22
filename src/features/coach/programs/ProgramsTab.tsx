import { useMemo, useState } from 'react'
import { Button, Card, ConfirmSheet, Icon, SectionTitle, toast } from '../../../ui'
import { useT } from '../../../i18n'
import { COMMON } from '../../../i18n/common'
import { remove, useStore } from '../../../data/store'
import type { Program } from '../../../data/types'
import { todayISO } from '../../../lib/dates'
import { programTemplateCSV, programToCSV } from '../../../lib/import/program'
import { downloadText } from '../lib/download'
import { exportFileName } from '../lib/exportData'
import { membersOnProgram, sortPrograms } from '../lib/programs'
import { toHandle } from '../lib/handle'
import { M } from '../messages'
import { ProgramCard } from './ProgramCard'
import { ImportSheet } from './ImportSheet'
import { DataCard } from './DataCard'
import './programs.css'

const CSV = 'text/csv;charset=utf-8'

/** Programs tab: built-in and imported programs, import/export, and the squad's data exports. */
export function ProgramsTab() {
  const t = useT(M)
  const tc = useT(COMMON)
  const programsById = useStore((s) => s.programs)
  const membersById = useStore((s) => s.members)
  const programs = useMemo(() => sortPrograms(Object.values(programsById)), [programsById])
  const members = useMemo(() => Object.values(membersById).sort((a, b) => a.name.localeCompare(b.name)), [membersById])
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState<Program | null>(null)

  const exportProgram = (p: Program) => {
    const file = `${toHandle(p.name) || 'program'}.csv`
    downloadText(file, programToCSV(p, { bom: true }), CSV)
    toast(t('downloaded', { file }), { tone: 'good' })
  }
  const downloadTemplate = () => {
    const file = exportFileName('program-template', todayISO(), 'csv')
    downloadText(file, programTemplateCSV({ bom: true }), CSV)
    toast(t('downloaded', { file }), { tone: 'good' })
  }

  return (
    <div className="coach-programs">
      <SectionTitle title={t('programsTitle')} eyebrow={t('programsSub', { n: programs.length })} />
      <ul className="program-grid">
        {programs.map((p) => (
          <li key={p.id}>
            <ProgramCard program={p} members={membersOnProgram(members, p.id)} onExport={() => exportProgram(p)} onDelete={() => setDeleting(p)} />
          </li>
        ))}
      </ul>

      <div className="program-bottom">
        <Card as="section" className="import-card" aria-labelledby="coach-import-title">
          <div className="import-card__icon" aria-hidden="true">
            <Icon name="file" size={22} />
          </div>
          <h2 id="coach-import-title" className="import-card__title">
            {t('importTitle')}
          </h2>
          <p className="import-card__body">{t('importBody')}</p>
          <div className="import-card__actions">
            <Button variant="primary" icon="upload" onClick={() => setImporting(true)}>
              {t('importBtn')}
            </Button>
            <Button variant="ghost" icon="download" onClick={downloadTemplate}>
              {t('template')}
            </Button>
          </div>
        </Card>
        <DataCard members={members} />
      </div>

      <ImportSheet open={importing} onClose={() => setImporting(false)} />
      <ConfirmSheet
        open={!!deleting}
        title={deleting ? t('deleteTitle', { name: deleting.name }) : ''}
        body={t('deleteBody')}
        confirmLabel={tc('delete')}
        danger
        onConfirm={() => {
          if (!deleting) return
          remove('programs', deleting.id)
          toast(t('deleted'))
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
