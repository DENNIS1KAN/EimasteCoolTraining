import type { ReactNode } from 'react'
import type { FileRef } from '../../data/types'
import { useT } from '../../i18n'
import { Icon, Spinner } from '../../ui'
import { useFileUrl } from './hooks'
import { fileExt, fileKind, fmtBytes } from './lib/files'
import { FM } from './messages'

/** File type badge: a paper icon with the extension, or the image itself as a thumbnail. */
export function FileThumb({ file, url }: { file: FileRef; url?: string | null }) {
  const kind = fileKind(file)
  if (kind === 'image' && url) {
    return (
      <span className="fu-file__thumb fu-file__thumb--img" aria-hidden="true">
        <img src={url} alt="" loading="lazy" decoding="async" />
      </span>
    )
  }
  return (
    <span className="fu-file__thumb" aria-hidden="true">
      <Icon name={kind === 'image' ? 'image' : 'file'} size={18} />
      <em>{fileExt(file.name) || (kind === 'pdf' ? 'PDF' : '')}</em>
    </span>
  )
}

/** One attached file: tapping the row opens it in a new tab. */
export function FileRow({ file, trailing }: { file: FileRef; trailing?: ReactNode }) {
  const t = useT(FM)
  const state = useFileUrl(file)
  const url = state.status === 'ready' ? state.url : null
  const meta =
    state.status === 'error' ? (state.missing ? t('fileMissing') : t('fileError')) : `${fileExt(file.name) || file.type} · ${fmtBytes(file.size)}`
  const body = (
    <>
      <FileThumb file={file} url={url} />
      <span className="fu-file__text">
        <span className="fu-file__name">{file.name}</span>
        <span className={`fu-file__meta${state.status === 'error' ? ' is-error' : ''}`}>{meta}</span>
      </span>
    </>
  )
  if (trailing) {
    return (
      <div className="fu-file">
        {body}
        {trailing}
      </div>
    )
  }
  if (!url) {
    return (
      <div className="fu-file" aria-busy={state.status === 'loading' || undefined}>
        {body}
        <span className="fu-file__go" aria-hidden="true">
          {state.status === 'loading' ? <Spinner size={16} decorative /> : <Icon name="alert" size={18} />}
        </span>
      </div>
    )
  }
  return (
    <a className="fu-file fu-file--link" href={url} target="_blank" rel="noopener noreferrer" aria-label={t('openFile', { name: file.name })}>
      {body}
      <span className="fu-file__go" aria-hidden="true">
        <Icon name="external" size={18} />
      </span>
    </a>
  )
}

export function PlanFiles({ files }: { files: FileRef[] }) {
  const t = useT(FM)
  if (!files.length) return null
  return (
    <ul className="fu-files" aria-label={t('planFiles')}>
      {files.map((f) => (
        <li key={f.path}>
          <FileRow file={f} />
        </li>
      ))}
    </ul>
  )
}
