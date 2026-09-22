import { useMemo } from 'react'
import { useParams } from 'react-router'
import { ButtonLink, EmptyState, IconButton, PageHeader, toast } from '../../ui'
import { useT } from '../../i18n'
import { useStore } from '../../data/store'
import { programToCSV } from '../../lib/import/program'
import { M } from './messages'
import { downloadText } from './lib/download'
import { toHandle } from './lib/handle'
import { membersOnProgram } from './lib/programs'
import { ProgramOverview } from './program/ProgramOverview'
import { WeeksAccordion } from './program/WeeksAccordion'
import './coach.css'
import './program/program.css'

/** Coach: one program in full (overview, weekly pattern, weeks → days → exercises). */
export default function CoachProgramPage() {
  const t = useT(M)
  const { id = '' } = useParams()
  const program = useStore((s) => s.programs[id] ?? null)
  const membersById = useStore((s) => s.members)
  const members = useMemo(
    () => (program ? membersOnProgram(Object.values(membersById), program.id).sort((a, b) => a.name.localeCompare(b.name)) : []),
    [membersById, program],
  )

  if (!program) {
    return (
      <div className="coach-page">
        <PageHeader back="/coach?tab=programs" eyebrow={t('programEyebrow')} title={t('programNotFound')} />
        <EmptyState
          icon="list"
          title={t('programNotFound')}
          body={t('programNotFoundBody')}
          action={
            <ButtonLink to="/coach?tab=programs" variant="secondary" icon="chevron-left">
              {t('backToPrograms')}
            </ButtonLink>
          }
        />
      </div>
    )
  }

  const exportCsv = () => {
    const file = `${toHandle(program.name) || 'program'}.csv`
    downloadText(file, programToCSV(program, { bom: true }), 'text/csv;charset=utf-8')
    toast(t('downloaded', { file }), { tone: 'good' })
  }

  return (
    <div className="coach-page coach-program">
      <PageHeader
        back="/coach?tab=programs"
        eyebrow={`${t('programEyebrow')} · ${program.builtIn ? t('builtIn') : t('imported')}`}
        title={program.name}
        actions={<IconButton icon="download" label={t('exportCsv')} onClick={exportCsv} />}
      />
      <div className="program-layout">
        <ProgramOverview program={program} members={members} />
        <WeeksAccordion program={program} />
      </div>
    </div>
  )
}
