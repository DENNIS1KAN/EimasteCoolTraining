import { useMemo, useState } from 'react'
import { useT } from '../../i18n'
import { COMMON } from '../../i18n/common'
import { put, update, useStore } from '../../data/store'
import type { Member, Program } from '../../data/types'
import { issueText } from '../../lib/import/issues'
import type { LogbookImportResult } from '../../lib/import/logbook'
import { fmtDate, fmtNum } from '../../lib/format'
import { Banner, Button, celebrate, EmptyState, Icon, Sheet, StatTile, Switch, toast } from '../../ui'
import { inferProgramStart, logsToWrite, summarizeImport } from './importPlan'
import { useProgramName } from '../train/programText'
import { SETTINGS } from './messages'

export interface ImportPreview {
  file: string
  result: LogbookImportResult
}

interface Props {
  preview: ImportPreview | null
  me: Member
  program: Program
  onClose: () => void
  onChooseAnother: () => void
}

const MAX_WARNINGS = 80

/** Preview of a logbook CSV before anything is written: counts, dates, overlaps, warnings, options. */
export function ImportSheet({ preview, me, program, onClose, onChooseAnother }: Props) {
  const t = useT(SETTINGS)
  const c = useT(COMMON)
  const programName = useProgramName(program)
  const existing = useStore((s) => s.logs)
  const [overwrite, setOverwrite] = useState(false)
  const [setStart, setSetStart] = useState(true)
  const logs = useMemo(() => preview?.result.logs ?? [], [preview])
  const warnings = preview?.result.warnings ?? []
  const summary = useMemo(() => summarizeImport(logs, existing), [logs, existing])
  const toWrite = useMemo(() => logsToWrite(logs, existing, overwrite), [logs, existing, overwrite])
  const inferred = useMemo(() => (me.programStart ? null : inferProgramStart(logs)), [logs, me.programStart])

  const doImport = () => {
    for (const l of toWrite) put('logs', l)
    if (setStart && inferred) update('members', me.id, { programStart: inferred })
    const n = toWrite.length
    toast(n === 1 ? t('importedOne') : t('imported', { n }), { tone: 'good' })
    celebrate({ intensity: 'small' })
    onClose()
  }

  const empty = logs.length === 0
  return (
    <Sheet
      open={!!preview}
      onClose={onClose}
      title={empty ? t('importTitle') : t('importPreview')}
      subtitle={preview ? `${t('importFile', { file: preview.file })} · ${t('importInto', { program: programName })}` : undefined}
      size={warnings.length > 6 ? 'full' : 'auto'}
      footer={
        empty ? (
          <Button variant="secondary" block icon="upload" onClick={onChooseAnother}>
            {t('chooseAnother')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" block onClick={onClose}>
              {c('cancel')}
            </Button>
            <Button variant="primary" block disabled={toWrite.length === 0} onClick={doImport}>
              {toWrite.length === 0 ? t('importNothing') : toWrite.length === 1 ? t('importCtaOne') : t('importCta', { n: toWrite.length })}
            </Button>
          </>
        )
      }
    >
      <div className="set-import">
        {empty ? (
          <EmptyState compact icon="file" title={t('importEmpty')} />
        ) : (
          <>
            <div className="grid-3">
              <StatTile label={t('statWorkouts')} value={fmtNum(summary.workouts, 0)} icon="train" />
              <StatTile label={t('statFinished')} value={fmtNum(summary.finished, 0)} icon="check" />
              <StatTile label={t('statSets')} value={fmtNum(summary.sets, 0)} icon="list" />
            </div>
            {summary.firstDate && summary.lastDate ? (
              <p className="set-import__span">
                <Icon name="calendar" size={16} />
                {summary.firstDate === summary.lastDate
                  ? t('importSpanOne', { date: fmtDate(summary.firstDate, 'medium'), week: summary.lastWeek })
                  : t('importSpan', { from: fmtDate(summary.firstDate, 'medium'), to: fmtDate(summary.lastDate, 'medium'), week: summary.lastWeek })}
              </p>
            ) : null}
            {summary.existing > 0 ? (
              <div className="set-import__opt">
                <Banner tone={overwrite ? 'warn' : 'info'} icon={overwrite ? 'alert' : 'info'}>
                  {summary.existing === 1
                    ? t(overwrite ? 'importExistingOverwriteOne' : 'importExistingOne')
                    : t(overwrite ? 'importExistingOverwrite' : 'importExisting', { n: summary.existing })}
                </Banner>
                <Switch checked={overwrite} onChange={setOverwrite} label={t('overwrite')} description={t('overwriteBody')} />
              </div>
            ) : null}
            {inferred ? (
              <Switch
                checked={setStart}
                onChange={setSetStart}
                label={t('setStart', { date: fmtDate(inferred, 'long') })}
                description={t('setStartBody')}
              />
            ) : null}
          </>
        )}
        {warnings.length ? (
          <details className="set-warnings" open={empty}>
            <summary>
              <Icon name="alert" size={16} />
              <span>{warnings.length === 1 ? t('warning') : t('warnings', { n: warnings.length })}</span>
              <Icon name="chevron-down" size={16} className="set-warnings__chev" />
            </summary>
            <ul>
              {warnings.slice(0, MAX_WARNINGS).map((w, i) => (
                <li key={i}>{issueText(w)}</li>
              ))}
              {warnings.length > MAX_WARNINGS ? <li className="muted">+{warnings.length - MAX_WARNINGS}</li> : null}
            </ul>
          </details>
        ) : null}
      </div>
    </Sheet>
  )
}
