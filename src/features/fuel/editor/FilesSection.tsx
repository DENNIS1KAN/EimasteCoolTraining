import type { FileRef } from '../../../data/types'
import { useT } from '../../../i18n'
import { Card, FileDrop, IconButton, Spinner } from '../../../ui'
import { FileRow } from '../PlanFiles'
import { FILE_ACCEPT } from '../lib/files'
import { FM } from '../messages'
import type { PendingUpload } from './useUploads'

export interface FilesSectionProps {
  files: FileRef[]
  pending: PendingUpload[]
  onFiles: (files: File[]) => void
  onRemove: (file: FileRef) => void
}

export function FilesSection({ files, pending, onFiles, onRemove }: FilesSectionProps) {
  const t = useT(FM)
  return (
    <Card as="section" className="fu-ed__card" aria-labelledby="fu-ed-files">
      <h2 id="fu-ed-files" className="fu-h">
        {t('files')}
      </h2>
      {(files.length > 0 || pending.length > 0) && (
        <ul className="fu-files fu-ed__files">
          {files.map((f) => (
            <li key={f.path}>
              <FileRow
                file={f}
                trailing={
                  <IconButton
                    icon="trash"
                    label={t('removeFile', { name: f.name })}
                    variant="ghost"
                    className="fu-ed__danger"
                    onClick={() => onRemove(f)}
                  />
                }
              />
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key}>
              <div className="fu-file" aria-busy="true">
                <span className="fu-file__thumb" aria-hidden="true">
                  <Spinner size={18} decorative />
                </span>
                <span className="fu-file__text">
                  <span className="fu-file__name">{p.name}</span>
                  <span className="fu-file__meta">{t('uploading')}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <FileDrop accept={FILE_ACCEPT} multiple onFiles={onFiles} label={t('dropLabel')} hint={t('filesHint')} icon="upload" />
    </Card>
  )
}
