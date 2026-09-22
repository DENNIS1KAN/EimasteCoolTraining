import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Banner, Button, Chip, FileDrop, Segmented, Sheet, TextArea, TextField, toast } from '../../../ui'
import { useLang, useT } from '../../../i18n'
import { COMMON } from '../../../i18n/common'
import { put, useMe, useStore } from '../../../data/store'
import { dayShortName } from '../../../data/programs'
import { issueText } from '../../../lib/import/issues'
import { DEFAULT_IMPORT_NAME, parseProgram } from '../../../lib/import/program'
import { fmtNum } from '../../../lib/format'
import { readFileText } from '../lib/download'
import { programIdFromName, programSummary } from '../lib/programs'
import { M } from '../messages'

type Mode = 'file' | 'paste'
const ACCEPT = '.csv,.json,.txt,.tsv,text/csv,application/json,text/plain,text/tab-separated-values'

/** "my-program_v2.csv" -> "my program v2" */
const nameFromFile = (file: string): string =>
  file
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim()

export interface ImportSheetProps {
  open: boolean
  onClose: () => void
}

/** Import a program from a CSV/JSON file or pasted text: preview (editable name, size, problems), then save. */
export function ImportSheet({ open, onClose }: ImportSheetProps) {
  // a fresh form every time the sheet has closed
  const [key, setKey] = useState(0)
  return <ImportSheetForm key={key} open={open} onClose={onClose} afterClose={() => setKey((k) => k + 1)} />
}

function ImportSheetForm({ open, onClose, afterClose }: ImportSheetProps & { afterClose: () => void }) {
  const t = useT(M)
  const tc = useT(COMMON)
  const lang = useLang()
  const me = useMe()
  const navigate = useNavigate()
  const programs = useStore((s) => s.programs)
  const [mode, setMode] = useState<Mode>('file')
  const [file, setFile] = useState<{ name: string; text: string } | null>(null)
  const [paste, setPaste] = useState('')
  const [readError, setReadError] = useState(false)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [triedSave, setTriedSave] = useState(false)

  const deferredPaste = useDeferredValue(paste)
  const text = mode === 'file' ? (file?.text ?? '') : deferredPaste
  const result = useMemo(() => (text.trim() ? parseProgram(text) : null), [text])
  const program = result && 'program' in result ? result.program : null
  const errors = result && 'errors' in result ? result.errors : []
  const warnings = result && 'warnings' in result ? result.warnings : []
  const summary = program ? programSummary(program) : null

  // A file without a program name: offer the file name, else a name in the viewer's language.
  const fileName = mode === 'file' && file ? nameFromFile(file.name) : ''
  const defaultName = !program ? '' : program.name !== DEFAULT_IMPORT_NAME ? program.name : fileName || t('untitledProgram')
  const name = nameDraft ?? defaultName
  const nameError = triedSave && !name.trim() ? t('programNameRequired') : null

  const onFiles = async (files: File[]) => {
    const f = files[0]
    if (!f) return
    setReadError(false)
    try {
      setFile({ name: f.name, text: await readFileText(f) })
      setNameDraft(null)
    } catch {
      setReadError(true)
    }
  }

  const save = () => {
    setTriedSave(true)
    if (!program || !name.trim()) return
    let id = programIdFromName(name)
    while (programs[id]) id = programIdFromName(name)
    const saved = put('programs', { ...program, id, name: name.trim(), builtIn: false, createdBy: me?.id ?? null, updatedAt: Date.now() })
    toast(t('programSaved', { name: saved.name }), {
      tone: 'good',
      action: { label: t('view'), onClick: () => navigate(`/coach/program/${encodeURIComponent(saved.id)}`) },
    })
    onClose()
  }

  const week1 = program?.weeks[0]

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose} block>
        {tc('cancel')}
      </Button>
      <Button variant="primary" icon="check" onClick={save} disabled={!program} block>
        {t('saveProgram')}
      </Button>
    </>
  )

  return (
    <Sheet open={open} onClose={onClose} afterClose={afterClose} title={t('importTitle')} subtitle={t('importBody')} footer={footer}>
      <div className="import-form stack-lg">
        <Segmented<Mode>
          options={[
            { value: 'file', label: t('importFile'), icon: 'file' },
            { value: 'paste', label: t('importPaste'), icon: 'copy' },
          ]}
          value={mode}
          onChange={(m) => {
            setMode(m)
            setNameDraft(null)
          }}
          ariaLabel={t('importMode')}
          block
        />

        {mode === 'file' ? (
          file ? (
            <div className="import-file">
              <Chip icon="file">{t('fromFile', { file: file.name })}</Chip>
              <Button variant="ghost" size="sm" icon="refresh" onClick={() => setFile(null)}>
                {t('startOver')}
              </Button>
            </div>
          ) : (
            <FileDrop accept={ACCEPT} onFiles={(fs) => void onFiles(fs)} label={t('dropLabel')} hint={t('dropHint')} icon="upload" />
          )
        ) : (
          <TextArea
            label={t('pasteLabel')}
            placeholder={t('pastePh')}
            rows={7}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            spellCheck={false}
            className="import-paste"
          />
        )}

        {readError ? <Banner tone="danger">{t('readFailed')}</Banner> : null}

        {errors.length ? (
          <Banner tone="danger" title={t('problems')} role="alert">
            <ul className={errors.length === 1 ? 'import-list import-list--single' : 'import-list'}>
              {errors.map((e, i) => (
                <li key={i}>{issueText(e, lang)}</li>
              ))}
            </ul>
          </Banner>
        ) : null}

        {program && summary ? (
          <section className="import-preview" aria-labelledby="import-preview-title">
            <p className="eyebrow" id="import-preview-title">
              {t('preview')}
            </p>
            <TextField label={t('programName')} value={name} onChange={(e) => setNameDraft(e.target.value)} error={nameError} maxLength={60} />
            <dl className="spec-strip">
              <div>
                <dt className="micro">{t('statWeeks')}</dt>
                <dd className="num">{fmtNum(summary.weeks, 0)}</dd>
              </div>
              <div>
                <dt className="micro">{t('statDays')}</dt>
                <dd className="num">{fmtNum(summary.daysPerWeek, 0)}</dd>
              </div>
              <div>
                <dt className="micro">{t('statExercises')}</dt>
                <dd className="num">{fmtNum(summary.uniqueExercises, 0)}</dd>
              </div>
            </dl>
            {week1 ? (
              <div className="import-days">
                <p className="micro">{tc('weekN', { n: 1 })}</p>
                <ul className="import-days__list">
                  {week1.days.map((d, i) => (
                    <li key={i}>
                      <Chip size="sm">
                        {dayShortName(d)} · {d.ex.length === 1 ? t('exerciseOne') : t('exercisesInDay', { n: d.ex.length })}
                      </Chip>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {summary.blocks.length ? <p className="import-blocks">{summary.blocks.join(' → ')}</p> : null}
            {warnings.length ? (
              <Banner tone="warn" title={t('headsUp')}>
                <ul className={warnings.length === 1 ? 'import-list import-list--single' : 'import-list'}>
                  {warnings.map((w, i) => (
                    <li key={i}>{issueText(w, lang)}</li>
                  ))}
                </ul>
              </Banner>
            ) : null}
          </section>
        ) : null}
      </div>
    </Sheet>
  )
}
