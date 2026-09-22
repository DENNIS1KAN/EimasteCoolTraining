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

export interface UploadsOptions {
  /** Uploads of an earlier session that a restored draft still points at: treated as this session's own. */
  adopt?: FileRef[]
  /**
   * Read when the editor unmounts without saving: the files a stored draft still references (they are kept for it).
   * Everything else uploaded in the session is deleted.
   */
  keepOnUnmount?: () => FileRef[]
}

/**
 * Uploads files for a plan being edited. Files uploaded in this session but never saved into a plan are
 * deleted again when the editor closes, so abandoned drafts leave nothing behind in storage. Files a stored draft
 * still points at (see lib/draftStore) survive until that draft is saved or discarded.
 */
export function useUploads(memberId: string | null, onUploaded: (ref: FileRef) => void, opts: UploadsOptions = {}) {
  const t = useT(FM)
  const [pending, setPending] = useState<PendingUpload[]>([])
  const session = useRef<FileRef[]>(opts.adopt ?? [])
  const committed = useRef(false)
  const alive = useRef(true)
  const cb = useRef(onUploaded)
  cb.current = onUploaded
  const keepRef = useRef(opts.keepOnUnmount)
  keepRef.current = opts.keepOnUnmount

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (committed.current) return
      const keep = new Set((keepRef.current?.() ?? []).map((f) => f.path))
      session.current.filter((f) => !keep.has(f.path)).forEach(drop)
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

  /** The draft was thrown away: delete everything uploaded for it. */
  const discard = () => commit([])

  return { pending, upload, commit, discard }
}
