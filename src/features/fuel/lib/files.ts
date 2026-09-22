import type { FileRef } from '../../../data/types'
import { fmtNum } from '../../../lib/format'

export const MAX_FILE_BYTES = 15 * 1024 * 1024

/**
 * What the `meal-plans` storage bucket accepts (supabase/schema.sql, allowed_mime_types): keep the two in sync.
 * Anything else (AVIF, BMP, SVG…) would pass a loose "image/*" check and then bounce off Storage with a 400.
 */
const UPLOAD_TYPE_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heic',
  gif: 'image/gif',
}
const UPLOAD_ALIASES: Record<string, string> = { 'image/jpg': 'image/jpeg', 'image/heif': 'image/heic' }
const UPLOAD_TYPES = new Set(Object.values(UPLOAD_TYPE_BY_EXT))

/**
 * The file picker's `accept`: the allowed types and their extensions, except HEIC. Leaving HEIC out makes iOS hand
 * over iPhone photos as JPEG, which every phone and browser can show; a HEIC that arrives some other way still
 * uploads (the bucket takes it).
 */
export const FILE_ACCEPT = 'application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp,image/gif,.gif'

/**
 * The content type a file will be stored with, or null when the bucket would reject it. Mirrors contentTypeFor in
 * src/data/backend/supabase-map.ts: the browser's type wins; the extension only fills in a missing or generic type.
 */
export function uploadType(f: { type: string; name: string }): string | null {
  const t = (f.type || '').trim().toLowerCase()
  if (t && t !== 'application/octet-stream') {
    const norm = UPLOAD_ALIASES[t] ?? t
    return UPLOAD_TYPES.has(norm) ? norm : null
  }
  const ext = /\.([a-z0-9]+)$/i.exec(f.name.trim())?.[1].toLowerCase() ?? ''
  return UPLOAD_TYPE_BY_EXT[ext] ?? null
}

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
  if (!uploadType(f)) return 'badType'
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
