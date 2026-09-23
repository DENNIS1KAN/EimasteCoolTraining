import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { FileRef, MealPlan } from '../../data/types'
import { getBackend, put, remove, update, useMe, useStore } from '../../data/store'
import { useT } from '../../i18n'
import { COMMON } from '../../i18n/common'
import { todayISO } from '../../lib/dates'
import { fmtRelative } from '../../lib/format'
import { uuid } from '../../lib/ids'
import { parseNum } from '../../lib/units'
import { Banner, Button, ButtonLink, Card, ConfirmSheet, EmptyState, PageHeader, toast, useIsDesktop } from '../../ui'
import { mayOpenEditor } from './access'
import { BasicsSection } from './editor/BasicsSection'
import { FilesSection } from './editor/FilesSection'
import { MealsSection } from './editor/MealsSection'
import { NotesSection } from './editor/NotesSection'
import { TargetsSection } from './editor/TargetsSection'
import { useUploads } from './editor/useUploads'
import { byNewest } from './hooks'
import {
  draftFromPlan,
  duplicateDraft,
  emptyDraft,
  hasErrors,
  othersToDeactivate,
  planFromDraft,
  sameDraft,
  validateDraft,
  type PlanDraft,
} from './lib/draft'
import { clearDraft, draftKey, loadDraft, storeDraft, type StoredDraft } from './lib/draftStore'
import { orphanedFiles } from './lib/files'
import { FM } from './messages'
import './fuel.css'
import './fuel-editor.css'

const dropFiles = (files: FileRef[]) =>
  files.forEach((f) =>
    getBackend()
      .deleteFile(f)
      .catch(() => undefined),
  )

/** /coach/plan/:slug/:planId: create ("new") or edit a member's meal plan. */
export default function MealPlanEditorPage() {
  const t = useT(FM)
  const tc = useT(COMMON)
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const { slug = '', planId = 'new' } = useParams()
  const me = useMe()
  const members = useStore((s) => s.members)
  const mealPlans = useStore((s) => s.mealPlans)
  const member = useMemo(() => Object.values(members).find((m) => m.slug === slug) ?? null, [members, slug])
  const isNew = planId === 'new'
  const existing = !isNew ? (mealPlans[planId] ?? null) : null
  const valid = !!member && (isNew || existing?.memberId === member.id)
  const memberPlans = useMemo(
    () =>
      Object.values(mealPlans)
        .filter((p) => p.memberId === member?.id)
        .sort(byNewest),
    [mealPlans, member],
  )
  const previous = isNew ? (memberPlans.find((p) => p.active) ?? memberPlans[0] ?? null) : null

  const [id] = useState(() => (isNew ? uuid() : planId))
  const [initial] = useState<PlanDraft | null>(() => (isNew ? emptyDraft(todayISO()) : existing ? draftFromPlan(existing) : null))
  // Unsaved work survives leaving the editor any way at all (a tab, the sidebar, the phone's back gesture, a reload):
  // it is stored on every change and picked up again here.
  const key = member && valid ? draftKey(member.id, isNew ? 'new' : planId) : null
  const [restored, setRestored] = useState<StoredDraft | null>(() => {
    const s = key && initial ? loadDraft(key) : null
    return s && !sameDraft(s.draft, initial as PlanDraft) ? s : null
  })
  const [draft, setDraft] = useState<PlanDraft | null>(() => restored?.draft ?? initial)
  const [showErrors, setShowErrors] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)
  const dirty = !!draft && !!initial && !sameDraft(draft, initial)
  // Read at unmount: the files the stored draft still points at are kept for it.
  const keepRef = useRef<FileRef[]>([])
  keepRef.current = dirty && !done && draft ? draft.files : []
  const uploads = useUploads(member?.id ?? null, (ref) => setDraft((d) => (d ? { ...d, files: [...d.files, ref] } : d)), {
    // Uploads from the earlier visit that no saved plan uses: this session owns them again (deleted if discarded).
    adopt: restored ? orphanedFiles(restored.draft.files, Object.values(mealPlans), '') : undefined,
    keepOnUnmount: () => keepRef.current,
  })

  useEffect(() => {
    if (!key || done) return
    if (dirty && draft) storeDraft(key, draft)
    else clearDraft(key)
  }, [key, draft, dirty, done])

  useEffect(() => {
    if (!dirty || done) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, done])

  if (!me) return null
  const backPath = me.role === 'coach' && member?.id !== me.id ? '/coach?tab=nutrition' : '/fuel'

  if (!member || !mayOpenEditor(me, member.id) || !valid || !draft) {
    const title = !member ? t('memberMissing') : !mayOpenEditor(me, member.id) ? t('noAccess') : t('notFound')
    return (
      <div className="fu-page stack">
        <PageHeader title={t('editPlanTitle')} back={backPath} />
        {!done && (
          <Card>
            <EmptyState
              icon="fuel"
              title={title}
              body={member && mayOpenEditor(me, member.id) ? t('notFoundBody') : undefined}
              action={
                <ButtonLink to={backPath} variant="secondary">
                  {tc('back')}
                </ButtonLink>
              }
            />
          </Card>
        )}
      </div>
    )
  }

  const errors = showErrors ? validateDraft(draft) : null
  const change = (patch: Partial<PlanDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  const save = () => {
    const errs = validateDraft(draft)
    if (hasErrors(errs)) {
      setShowErrors(true)
      toast(t('fixErrors'), { tone: 'danger' })
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.fu-ed [aria-invalid="true"]')?.focus())
      return
    }
    const plan: MealPlan = planFromDraft(draft, {
      id,
      memberId: member.id,
      createdBy: existing?.createdBy ?? me.id,
      createdAt: existing?.createdAt ?? Date.now(),
    })
    put('mealPlans', plan)
    if (key) clearDraft(key)
    if (plan.active) for (const o of othersToDeactivate(Object.values(mealPlans), member.id, id)) update('mealPlans', o.id, { active: false })
    const removed = (existing?.files ?? []).filter((f) => !plan.files.some((g) => g.path === f.path))
    dropFiles(orphanedFiles(removed, Object.values(mealPlans), id))
    uploads.commit(plan.files)
    setDone(true)
    toast(t('savedToast'), { tone: 'good' })
    navigate(backPath)
  }

  const del = () => {
    if (!existing) return
    setDone(true)
    if (key) clearDraft(key)
    remove('mealPlans', existing.id)
    // The active plan is gone: the newest remaining one takes over.
    const successor = existing.active ? memberPlans.find((p) => p.id !== existing.id) : undefined
    if (successor && !successor.active) update('mealPlans', successor.id, { active: true })
    dropFiles(orphanedFiles(existing.files, Object.values(mealPlans), existing.id))
    uploads.commit([])
    toast(t('deletedToast'))
    navigate(backPath)
  }

  // Back to the saved plan (or a blank one): this session's uploads stay tracked and go if never saved.
  const discardRestored = () => {
    setRestored(null)
    setShowErrors(false)
    setDraft(initial)
    if (key) clearDraft(key)
  }
  const restoredBanner = restored && (
    <Banner
      tone="info"
      icon="history"
      role="status"
      onDismiss={() => setRestored(null)}
      action={
        <Button variant="ghost" size="sm" icon="refresh" onClick={discardRestored}>
          {t('discardDraft')}
        </Button>
      }
    >
      {t('draftRestored', { when: fmtRelative(restored.savedAt) })}
    </Banner>
  )

  const duplicate = () => {
    if (!previous) return
    setDraft(duplicateDraft(previous, todayISO(), uuid))
    setCopied(true)
    toast(t('duplicated', { title: previous.title }))
  }

  // Guard the header's back link while there are unsaved changes.
  const onHeaderClick = (e: MouseEvent) => {
    if (!dirty || !(e.target as Element).closest('.ui-page-header__back')) return
    e.preventDefault()
    e.stopPropagation()
    setConfirmLeave(true)
  }

  const header = (
    <div onClickCapture={onHeaderClick}>
      <PageHeader eyebrow={t('planFor', { name: member.name })} title={isNew ? t('newPlanTitle') : t('editPlanTitle')} back={backPath} />
    </div>
  )
  const copyCard = previous && !copied && (
    <Card as="section" className="fu-ed__copy">
      <div className="fu-ed__copy-text">
        <p className="fu-sub">{t('duplicate')}</p>
        <p className="fu-hint">{t('duplicateDesc', { title: previous.title })}</p>
      </div>
      <Button variant="secondary" size="sm" icon="copy" onClick={duplicate}>
        {t('copy')}
      </Button>
    </Card>
  )
  const basics = <BasicsSection draft={draft} errors={errors} onChange={change} />
  const targets = <TargetsSection draft={draft} errors={errors} onChange={change} />
  const meals = <MealsSection meals={draft.meals} errors={errors} kcalTarget={parseNum(draft.kcal)} onChange={(m) => change({ meals: m })} />
  const notes = <NotesSection notes={draft.notes} onChange={(n) => change({ notes: n })} />
  const files = (
    <FilesSection
      files={draft.files}
      pending={uploads.pending}
      onFiles={(f) => void uploads.upload(f)}
      onRemove={(f) => change({ files: draft.files.filter((x) => x.path !== f.path) })}
    />
  )
  const busy = uploads.pending.length > 0

  return (
    <div className="fu-page fu-ed">
      {header}
      {restoredBanner}
      <div className={isDesktop ? 'fu-cols' : 'stack fu-ed__stack'}>
        {isDesktop ? (
          <>
            <div className="stack">
              {copyCard}
              {basics}
              {targets}
              {notes}
            </div>
            <div className="stack">
              {meals}
              {files}
            </div>
          </>
        ) : (
          <>
            {copyCard}
            {basics}
            {targets}
            {meals}
            {notes}
            {files}
          </>
        )}
      </div>
      <div className="fu-ed__dock">
        <div className="fu-ed__bar">
          {dirty && <span className="fu-ed__dirty">{t('unsaved')}</span>}
          {existing && (
            <Button variant="ghost" icon="trash" className="fu-ed__del" onClick={() => setConfirmDelete(true)}>
              {t('deletePlan')}
            </Button>
          )}
          <Button icon="check" loading={busy} onClick={save} className="fu-ed__save">
            {busy ? t('uploading') : t('savePlan')}
          </Button>
        </div>
      </div>
      <ConfirmSheet
        open={confirmDelete}
        title={t('deleteTitle')}
        body={t('deleteBody', { title: existing?.title ?? '' })}
        confirmLabel={tc('delete')}
        danger
        onConfirm={del}
        onClose={() => setConfirmDelete(false)}
      />
      <ConfirmSheet
        open={confirmLeave}
        title={t('leaveTitle')}
        body={t('leaveBody')}
        confirmLabel={t('discard')}
        danger
        onConfirm={() => {
          setDone(true)
          if (key) clearDraft(key)
          uploads.discard()
          navigate(backPath)
        }}
        onClose={() => setConfirmLeave(false)}
      />
    </div>
  )
}
