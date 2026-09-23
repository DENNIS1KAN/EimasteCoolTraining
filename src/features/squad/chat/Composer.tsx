import { useRef, useState } from 'react'
import { useMe } from '../../../data/store'
import { useT } from '../../../i18n'
import { Icon } from '../../../ui'
import { toast } from '../../../ui/toast'
import { MAX_PHOTOS, MAX_TEXT, sendPost, uploadPhotos } from './postActions'
import { SQ } from '../messages'

export interface ComposerProps {
  /** Home uses a single line that grows on focus; the Chat tab is always open. */
  compact?: boolean
  onSent?: () => void
}

/**
 * The one place a post is written. Home and the Chat tab both mount this, so send, retry and the photo
 * picker exist once. Photos are shrunk and uploaded before the post is written, so a post never points at
 * a file that isn't there yet.
 */
export function Composer({ compact, onSent }: ComposerProps) {
  const t = useT(SQ)
  const me = useMe()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(!compact)
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  if (!me) return null

  const canSend = (text.trim().length > 0 || files.length > 0) && !busy

  const pick = (list: FileList | null) => {
    if (!list?.length) return
    const next = [...files, ...Array.from(list)].slice(0, MAX_PHOTOS)
    setFiles(next)
    setOpen(true)
  }

  const send = async () => {
    if (!canSend) return
    setBusy(true)
    try {
      const photos = files.length ? await uploadPhotos(me.id, files) : []
      sendPost(me.id, text, photos)
      setText('')
      setFiles([])
      if (compact) setOpen(false)
      onSent?.()
    } catch {
      toast(t('sendFailed'), { tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`sq-composer${compact ? ' is-compact' : ''}${open ? ' is-open' : ''}`}>
      {files.length > 0 && (
        <ul className="sq-composer__thumbs">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <img src={URL.createObjectURL(f)} alt="" />
              <button type="button" aria-label={t('removePhoto')} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <Icon name="x" size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="sq-composer__row">
        <button
          type="button"
          className="sq-composer__photo"
          aria-label={t('addPhoto')}
          disabled={busy || files.length >= MAX_PHOTOS}
          onClick={() => fileRef.current?.click()}
        >
          <Icon name="image" size={19} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
        <textarea
          ref={taRef}
          className="sq-composer__input"
          value={text}
          rows={open ? 2 : 1}
          maxLength={MAX_TEXT}
          placeholder={t('composerPh')}
          aria-label={t('composerPh')}
          onFocus={() => setOpen(true)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <button type="button" className="sq-composer__send" aria-label={t('send')} disabled={!canSend} onClick={() => void send()}>
          <Icon name={busy ? 'refresh' : 'chevron-right'} size={17} />
        </button>
      </div>
    </div>
  )
}
