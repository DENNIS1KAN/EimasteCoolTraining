import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Avatar, Button, Segmented, Sheet, TextField } from '../../../ui'
import { useT } from '../../../i18n'
import { COMMON } from '../../../i18n/common'
import type { Member, MemberColor, Role } from '../../../data/types'
import { getBackend, refresh } from '../../../data/store'
import { BackendError } from '../../../data/backend/types'
import { ColorPicker } from '../components/ColorPicker'
import { InviteLinkBox } from '../components/InviteLinkBox'
import { firstFreeColor, usedColors } from '../lib/colors'
import { cleanHandleInput, isValidHandle, toHandle, uniqueHandle } from '../lib/handle'
import { appLocation, inviteLink } from '../lib/invite'
import { M } from '../messages'

export interface AddMemberSheetProps {
  open: boolean
  onClose: () => void
  members: Member[]
  /** Report the new member's invite code (keeps the list's links fresh). */
  onCode: (memberId: string, code: string) => void
}

interface Created {
  id: string
  name: string
  slug: string
  color: MemberColor
  link: string | null
}

/** "Add member": name, auto-derived username, role and color, then the new invite link ready to share. */
export function AddMemberSheet({ open, onClose, members, onCode }: AddMemberSheetProps) {
  const t = useT(M)
  const [formKey, setFormKey] = useState(0)
  const [created, setCreated] = useState<Created | null>(null)

  const close = () => {
    onClose()
  }
  const reset = () => {
    setCreated(null)
    setFormKey((k) => k + 1)
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      afterClose={reset}
      title={created ? t('created', { name: created.name }) : t('addTitle')}
      subtitle={created ? t('createdBody') : t('addSub')}
    >
      {created ? (
        <CreatedView created={created} onAnother={reset} onDone={close} />
      ) : (
        <AddMemberForm
          key={formKey}
          members={members}
          onCreated={(c, code) => {
            if (code) onCode(c.id, code)
            setCreated(c)
          }}
        />
      )}
    </Sheet>
  )
}

function AddMemberForm({ members, onCreated }: { members: Member[]; onCreated: (c: Created, code: string | null) => void }) {
  const t = useT(M)
  const tc = useT(COMMON)
  const taken = useMemo(() => new Set(members.map((m) => m.slug)), [members])
  const used = useMemo(() => usedColors(members), [members])
  const [name, setName] = useState('')
  const [handleDraft, setHandleDraft] = useState<string | null>(null)
  const [role, setRole] = useState<Role>('athlete')
  const [color, setColor] = useState<MemberColor>(() => firstFreeColor(members))
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverTaken, setServerTaken] = useState<string | null>(null)

  const handle = handleDraft ?? uniqueHandle(toHandle(name), taken)
  const cleanName = name.trim().replace(/\s+/g, ' ')
  const nameError = submitted && !cleanName ? t('nameRequired') : null
  const handleError =
    handle && (taken.has(handle) || handle === serverTaken)
      ? t('handleTaken')
      : (submitted || handleDraft != null) && handle && !isValidHandle(handle)
        ? t('handleInvalid')
        : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setError(null)
    if (!cleanName || !isValidHandle(handle) || taken.has(handle)) return
    setBusy(true)
    try {
      const b = getBackend()
      const id = await b.createMember({ slug: handle, name: cleanName, role, color })
      await refresh()
      let code: string | null = null
      try {
        code = (await b.invites())[id] ?? null
      } catch {
        /* the link can be fetched again from the list */
      }
      onCreated({ id, name: cleanName, slug: handle, color, link: code ? inviteLink(appLocation(), handle, code) : null }, code)
    } catch (err) {
      if (err instanceof BackendError && err.code === 'conflict') setServerTaken(handle)
      else setError(t('createFailed', { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="add-member stack-lg" onSubmit={submit} noValidate>
      <div className="add-member__preview" aria-hidden="true">
        <Avatar member={{ name: cleanName || '?', color }} size={54} />
        <div>
          <p className="add-member__preview-name">{cleanName || t('namePh')}</p>
          <p className="add-member__preview-handle">@{handle || '…'}</p>
        </div>
      </div>
      <TextField
        label={t('name')}
        placeholder={t('namePh')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={nameError}
        autoComplete="off"
        autoCapitalize="words"
        maxLength={40}
        data-autofocus
        required
      />
      <TextField
        label={t('handle')}
        value={handle}
        onChange={(e) => setHandleDraft(cleanHandleInput(e.target.value))}
        onBlur={() => handleDraft != null && setHandleDraft(handleDraft.replace(/-+$/, ''))}
        hint={t('handleHint')}
        error={handleError}
        icon="user"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="url"
        maxLength={24}
      />
      <div className="ui-field">
        <p className="ui-field__label" id="add-member-role">
          {t('role')}
        </p>
        <Segmented<Role>
          options={[
            { value: 'athlete', label: tc('athlete'), icon: 'dumbbell-plate' },
            { value: 'coach', label: tc('coach'), icon: 'whistle' },
          ]}
          value={role}
          onChange={setRole}
          ariaLabel={t('role')}
          block
        />
      </div>
      <ColorPicker label={t('color')} hint={t('colorHint')} value={color} onChange={setColor} used={used} freeFirst />
      {error ? (
        <p className="coach-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" block icon="user-plus" loading={busy}>
        {busy ? t('creating') : t('create')}
      </Button>
    </form>
  )
}

function CreatedView({ created, onAnother, onDone }: { created: Created; onAnother: () => void; onDone: () => void }) {
  const t = useT(M)
  const tc = useT(COMMON)
  return (
    <div className="stack-lg">
      <div className="add-member__done">
        <Avatar member={created} size={80} />
        <p className="add-member__preview-handle">@{created.slug}</p>
      </div>
      {created.link ? <InviteLinkBox member={created} link={created.link} primary /> : <p className="muted">{t('invitesError')}</p>}
      <Link to={`/coach/member/${created.slug}`} className="add-member__next">
        {t('setStart')} · {t('program')}
      </Link>
      <div className="row add-member__footer">
        <Button variant="ghost" icon="user-plus" onClick={onAnother} block>
          {t('addAnother')}
        </Button>
        <Button variant="secondary" onClick={onDone} block>
          {tc('done')}
        </Button>
      </div>
    </div>
  )
}
