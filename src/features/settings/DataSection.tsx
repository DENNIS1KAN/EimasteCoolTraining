import { useRef, useState } from 'react'
import { useT } from '../../i18n'
import { getState, useStore } from '../../data/store'
import { BTS_PROGRAM, DEFAULT_PROGRAM_ID } from '../../data/programs'
import type { Member } from '../../data/types'
import { importLogbookCSV } from '../../lib/import/logbook'
import { todayISO } from '../../lib/dates'
import { FileDrop, Icon, toast, type IconName } from '../../ui'
import { APP_VERSION } from './version'
import { buildMyData, downloadText, exportFileName, myWorkoutsCSV } from './exportData'
import { ImportSheet, type ImportPreview } from './ImportSheet'
import { useProgramName } from '../train/programText'
import { SETTINGS } from './messages'
import { Section } from './Section'

function ExportRow({ icon, title, sub, disabled, onClick }: { icon: IconName; title: string; sub: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="set-row" onClick={onClick} disabled={disabled}>
      <span className="set-row__icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span className="set-row__text">
        <span className="set-row__title">{title}</span>
        <span className="set-row__sub">{sub}</span>
      </span>
      <Icon name="download" size={18} className="set-row__chev" />
    </button>
  )
}

/** Import the old BTS logbook CSV (with a preview), and export my rows as JSON / my workouts as CSV. */
export function DataSection({ me }: { me: Member }) {
  const t = useT(SETTINGS)
  const program = useStore((s) => s.programs[me.programId ?? DEFAULT_PROGRAM_ID] ?? s.programs[DEFAULT_PROGRAM_ID] ?? BTS_PROGRAM)
  const programName = useProgramName(program)
  const myLogCount = useStore((s) => {
    let n = 0
    for (const l of Object.values(s.logs)) if (l.memberId === me.id) n++
    return n
  })
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [reading, setReading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const dropRef = useRef<HTMLDivElement>(null)

  const onFiles = async (files: File[]) => {
    const f = files[0]
    if (!f) return
    setReading(true)
    try {
      const text = await f.text()
      setAttempt((n) => n + 1)
      setPreview({ file: f.name, result: importLogbookCSV(text, { memberId: me.id, program, unit: me.settings.unit }) })
    } catch {
      toast(t('importReadError'), { tone: 'danger' })
    } finally {
      setReading(false)
    }
  }

  const chooseAnother = () => {
    setPreview(null)
    setTimeout(() => dropRef.current?.querySelector<HTMLButtonElement>('button')?.click(), 250)
  }

  const exportJson = () => {
    const name = exportFileName(me.slug, todayISO(), 'data')
    downloadText(name, JSON.stringify(buildMyData(me, getState(), APP_VERSION), null, 2), 'application/json')
    toast(t('downloaded', { file: name }))
  }
  const exportCsv = () => {
    const name = exportFileName(me.slug, todayISO(), 'workouts')
    downloadText(name, myWorkoutsCSV(me, getState()), 'text/csv;charset=utf-8')
    toast(t('downloaded', { file: name }))
  }

  return (
    <Section id="data" icon="file" title={t('data')}>
      <div className="set-sub">
        <p className="set-sub__title">{t('importTitle')}</p>
        <p className="set-note">{t('importBody')}</p>
      </div>
      <div ref={dropRef}>
        <FileDrop
          accept=".csv,text/csv,text/plain,application/vnd.ms-excel"
          onFiles={(fs) => void onFiles(fs)}
          label={reading ? t('importReading') : t('importDrop')}
          hint={`${t('importDropHint')} · ${t('importInto', { program: programName })}`}
          icon="upload"
          buttonLabel={t('importChoose')}
          disabled={reading}
        />
      </div>
      <div className="set-sub set-sub--gap">
        <p className="set-sub__title">{t('exportTitle')}</p>
        <p className="set-note">{myLogCount ? t('exportBody') : t('noWorkouts')}</p>
      </div>
      <div className="set-rows">
        <ExportRow icon="file" title={t('exportJson')} sub={t('exportJsonSub')} onClick={exportJson} />
        <ExportRow icon="list" title={t('exportCsv')} sub={t('exportCsvSub')} disabled={!myLogCount} onClick={exportCsv} />
      </div>
      <ImportSheet key={attempt} preview={preview} me={me} program={program} onClose={() => setPreview(null)} onChooseAnother={chooseAnother} />
    </Section>
  )
}
