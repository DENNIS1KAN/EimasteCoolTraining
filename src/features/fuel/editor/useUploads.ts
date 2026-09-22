import { useEffect, useRef, useState } from 'react'
import type { FileRef } from '../../../data/types'
import { getBackend } from '../../../data/store'
import { useT } from '../../../i18n'
import { uuid } from '../../../lib/ids'
import { toast } from '../../../ui'
import { checkUpload } from '../lib/files'
import { FM } from '../messages'

export interface PendingUpload {
  key: string
  name: string
}

const drop = (f: FileRef) => {
  getBackend()
    .deleteFile(f)
    .catch(() => undefined)
}

/**
 * Uploads files for a plan being edited. Files uploaded in this session but never saved into a plan are
 * deleted again when the editor closes, so abandoned drafts leave nothing behind in storage.
 */
export function useUploads(memberId: string | null, onUploaded: (ref: FileRef) => void) {
  const t = useT(FM)
  const [pending, setPending] = useState<PendingUpload[]>([])
  const session = useRef<FileRef[]>([])
  const committed = useRef(false)
  const alive = useRef(true)
  const cb = useRef(onUploaded)
  cb.current = onUploaded

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (!committed.current) session.current.forEach(drop)
    }
  }, [])

  const upload = async (files: File[]) => {
    if (!memberId) return
    await Promise.all(
      files.map(async (file) => {
        const problem = checkUpload(file)
        if (problem) {
          toast(t(problem === 'empty' ? 'emptyFile' : problem, { name: file.name }), { tone: 'danger' })
          return
        }
        const key = uuid()
        setPending((p) => [...p, { key, name: file.name }])
        try {
          const ref = await getBackend().uploadFile(memberId, file)
          if (!alive.current && !committed.current) {
            drop(ref)
            return
          }
          session.current.push(ref)
          cb.current(ref)
        } catch (e) {
          const tooLarge = typeof e === 'object' && e != null && (e as { code?: string }).code === 'too_large'
          toast(t(tooLarge ? 'tooLarge' : 'uploadFailed', { name: file.name }), { tone: 'danger' })
        } finally {
          if (alive.current) setPending((p) => p.filter((x) => x.key !== key))
        }
      }),
    )
  }

  /** The plan was saved with `kept`: keep those, delete the rest of this session's uploads. */
  const commit = (kept: FileRef[]) => {
    committed.current = true
    const keep = new Set(kept.map((f) => f.path))
    session.current.filter((f) => !keep.has(f.path)).forEach(drop)
    session.current = []
  }

  return { pending, upload, commit }
}
