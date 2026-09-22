import type { FileRef } from '../../../data/types'
import { fmtNum } from '../../../lib/format'

export const MAX_FILE_BYTES = 15 * 1024 * 1024
export const FILE_ACCEPT = 'application/pdf,image/*'

export type FileKind = 'pdf' | 'image' | 'other'

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)$/i

export function fileKind(f: Pick<FileRef, 'type' | 'name'>): FileKind {
  const type = (f.type || '').toLowerCase()
  if (type === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'pdf'
  if (type.startsWith('image/') || IMAGE_EXT.test(f.name)) return 'image'
  return 'other'
}

/** "PDF", "JPG", "PNG"; "" without an extension. */
export function fileExt(name: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name.trim())
  return m ? m[1].toUpperCase().replace('JPEG', 'JPG') : ''
}

export type UploadProblem = 'tooLarge' | 'badType' | 'empty'

export function checkUpload(f: { size: number; type: string; name: string }): UploadProblem | null {
  if (fileKind(f) === 'other') return 'badType'
  if (f.size <= 0) return 'empty'
  if (f.size > MAX_FILE_BYTES) return 'tooLarge'
  return null
}

/** 1 234 567 -> "1.2 MB", 84 000 -> "82 KB", 900 -> "900 B" (locale-aware digits). */
export function fmtBytes(n: number): string {
  if (n < 1024) return `${fmtNum(Math.max(0, n), 0)} B`
  if (n < 1024 * 1024) return `${fmtNum(n / 1024, 0)} KB`
  return `${fmtNum(n / (1024 * 1024), 1)} MB`
}

/** Files of `removed` that no other plan still points at (safe to delete from storage). */
export function orphanedFiles(removed: FileRef[], plans: { id: string; files: FileRef[] }[], exceptPlanId: string): FileRef[] {
  const used = new Set(plans.filter((p) => p.id !== exceptPlanId).flatMap((p) => p.files.map((f) => f.path)))
  return removed.filter((f) => !used.has(f.path))
}
