import { useMemo, useState } from 'react'
import { Avatar, Button, ButtonLink, Card, CardHeader, memberColorVar, NumberField, PageHeader, Switch, Tag, TextField, toast } from '../../../ui'
import { useT } from '../../../i18n'
import { COMMON } from '../../../i18n/common'
import { update, useStore } from '../../../data/store'
import type { Member } from '../../../data/types'
import { GOAL_KG, draftEquals, fromDraft, toDraft, type DraftErrors, type MemberDraft } from '../lib/memberForm'
import { usedColors } from '../lib/colors'
import { kgToUnit } from '../../../lib/units'
import { fmtNum, fmtRelative } from '../../../lib/format'
import { todayISO } from '../../../lib/dates'
import { programWeekOn } from '../../../lib/stats'
import { lastActiveAt } from '../lib/glance'
import { ColorPicker } from '../components/ColorPicker'
import { M } from '../messages'
import { ProgramSection } from './ProgramSection'
import { CoachNoteCard } from './CoachNoteCard'
import { LoginCard } from './LoginCard'
import './member.css'

export interface MemberEditorProps {
  member: Member
  viewer: Member
}

/** The edit-member form: a draft of the profile fields saved with one tap; note and login act immediately. */
export function MemberEditor({ member, viewer }: MemberEditorProps) {
  const t = useT(M)
  const tc = useT(COMMON)
  const unit = viewer.settings.unit
  const membersById = useStore((s) => s.members)
  const programsById = useStore((s) => s.programs)
  const lastActive = useStore((s) => lastActiveAt(s, member.id))
  const used = useMemo(() => usedColors(Object.values(membersById), member.id), [membersById, member.id])

  // The draft follows the stored member until the coach edits something.
  const base = useMemo(() => toDraft(member, unit), [member, unit])
  const [edited, setEdited] = useState<MemberDraft | null>(null)
  const draft = edited ?? base
  const dirty = edited != null && !draftEquals(edited, base)
  const [showErrors, setShowErrors] = useState(false)
  const set = (patch: Partial<MemberDraft>) => setEdited({ ...draft, ...patch })

  const { errors } = fromDraft(draft, unit)
  const err = (k: keyof DraftErrors): string | null => {
    if (!showErrors || !errors[k]) return null
    const e = errors[k]
    if (k === 'name') return t('errRequired')
    if (k === 'programStart') return t('errDate')
    if (e === 'invalid') return t('errNumber')
    if (k === 'height') return t('errHeightRange')
    return t('errGoalRange', { min: fmtNum(kgToUnit(GOAL_KG.min, unit), 0), max: fmtNum(kgToUnit(GOAL_KG.max, unit), 0), unit })
  }

  const save = () => {
    const r = fromDraft(draft, unit)
    if (!r.patch) {
      setShowErrors(true)
      toast(t('fixErrors'), { tone: 'danger' })
      return
    }
    update('members', member.id, r.patch)
    setEdited(null)
    setShowErrors(false)
    toast(t('saved'), { tone: 'good' })
  }
  const discard = () => {
    setEdited(null)
    setShowErrors(false)
  }

  const isMe = member.id === viewer.id
  const previewName = draft.name.trim() || member.name
  const program = member.programId ? programsById[member.programId] : undefined
  const week = program && member.programStart ? programWeekOn(program, member.programStart, todayISO()) : 0
  const programLine = !program
    ? t('noProgram')
    : week > 0
      ? t('programWeek', { program: program.name, week })
      : t('programNotStarted', { program: program.name })

  return (
    <div className="coach-page coach-member">
      <PageHeader
        back="/coach"
        eyebrow={t('editEyebrow')}
        title={member.name}
        actions={
          <ButtonLink to={`/member/${member.slug}`} variant="secondary" size="sm" icon="eye">
            {t('viewProfile')}
          </ButtonLink>
        }
      />

      <Card className="member-id" glow={memberColorVar(draft.color)}>
        <Avatar member={{ name: previewName, color: draft.color }} size={54} you={isMe} />
        <div className="member-id__text">
          <p className="member-id__handle">
            @{member.slug} · {member.role === 'coach' ? tc('coach') : tc('athlete')}
          </p>
          <p className="member-id__meta">{programLine}</p>
          <p className="member-id__meta">{lastActive ? t('activeAgo', { when: fmtRelative(lastActive) }) : t('noActivity')}</p>
        </div>
        {member.joined ? (
          <Tag tone="good" icon="check">
            {t('joined')}
          </Tag>
        ) : (
          <Tag tone="warn" icon="clock">
            {t('invitePending')}
          </Tag>
        )}
      </Card>

      <div className="member-grid">
        <div className="member-col">
          <Card as="section" aria-labelledby="member-profile-title" className="coach-stack">
            <CardHeader title={<span id="member-profile-title">{t('profile')}</span>} />
            <TextField label={t('name')} value={draft.name} onChange={(e) => set({ name: e.target.value })} error={err('name')} maxLength={40} autoComplete="off" />
            <ColorPicker label={t('color')} hint={t('colorHint')} value={draft.color} onChange={(color) => set({ color })} used={used} />
            <Switch checked={draft.competes} onChange={(competes) => set({ competes })} label={t('competes')} description={t('competesDesc')} />
          </Card>

          <ProgramSection draft={draft} set={set} error={err('programStart')} />

          <Card as="section" aria-labelledby="member-goals-title" className="coach-stack">
            <CardHeader title={<span id="member-goals-title">{t('goals')}</span>} />
            <TextField label={t('goal')} placeholder={t('goalPh')} value={draft.goal} onChange={(e) => set({ goal: e.target.value })} maxLength={120} />
            <div className="grid-2">
              <NumberField label={t('goalWeight')} value={draft.goalWeight} onChange={(goalWeight) => set({ goalWeight })} decimals={1} suffix={unit} error={err('goalWeight')} />
              <NumberField label={t('height')} value={draft.height} onChange={(height) => set({ height })} decimals={0} suffix="cm" error={err('height')} />
            </div>
          </Card>
        </div>

        <div className="member-col">
          <CoachNoteCard member={member} />
          <LoginCard member={member} />
        </div>
      </div>

      {dirty ? (
        <div className="save-bar" role="region" aria-label={t('unsaved')}>
          <p className="save-bar__text">
            <span className="save-bar__dot" aria-hidden="true" />
            {t('unsaved')}
          </p>
          <Button variant="ghost" size="sm" onClick={discard}>
            {t('discard')}
          </Button>
          <Button variant="primary" size="sm" icon="check" onClick={save}>
            {tc('save')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
