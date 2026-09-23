import { put, remove, getBackend } from '../../../data/store'
import { CHAT_BUCKET } from '../../../data/backend/supabase'
import type { FileRef, Post } from '../../../data/types'
import { uuid } from '../../../lib/ids'

/** Longest edge of an uploaded photo. A phone shot is ~4000px and ~4 MB; this lands nearer 300 KB. */
export const MAX_EDGE = 1600
const QUALITY = 0.82
export const MAX_PHOTOS = 4
export const MAX_TEXT = 2000

/**
 * Shrink a photo in the browser before it is uploaded. Supabase's free tier is 1 GB, so the difference
 * between sending the original and sending this is the difference between years and months of chat.
 * Anything that isn't a decodable image (or a browser without the APIs) is passed through untouched.
 */
export async function downscale(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    return file
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
  if (scale === 1 && file.size < 400_000) {
    bmp.close()
    return file
  }
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  try {
    const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h })
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
    if (!ctx) return file
    ctx.drawImage(bmp, 0, 0, w, h)
    const blob =
      canvas instanceof OffscreenCanvas
        ? await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY })
        : await new Promise<Blob | null>((res) => (canvas as HTMLCanvasElement).toBlob(res, 'image/jpeg', QUALITY))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  } finally {
    bmp.close()
  }
}

/** Upload the photos for a post, smallest-first so a slow one never blocks the others. */
export async function uploadPhotos(memberId: string, files: File[]): Promise<FileRef[]> {
  const backend = getBackend()
  const shrunk = await Promise.all(files.slice(0, MAX_PHOTOS).map(downscale))
  return Promise.all(shrunk.map((f) => backend.uploadFile(memberId, f, CHAT_BUCKET)))
}

/** Write a post. Optimistic: it appears at once and the outbox sends it, retrying if the gym has no signal. */
export function sendPost(memberId: string, text: string, photos: FileRef[] = []): Post | null {
  const clean = text.trim().slice(0, MAX_TEXT)
  if (!clean && !photos.length) return null
  const now = Date.now()
  const post: Post = { id: uuid(), memberId, text: clean, photos, createdAt: now, editedAt: null, updatedAt: now }
  return put('posts', post)
}

/** Delete a post and the photos only it was holding. */
export async function deletePost(post: Post): Promise<void> {
  remove('posts', post.id)
  const backend = getBackend()
  await Promise.all(post.photos.map((f) => backend.deleteFile(f).catch(() => undefined)))
}

/** Who may delete a post: its author, or the coach (moderation). */
export const canDelete = (post: Post, viewer: { id: string; role: string } | null): boolean =>
  !!viewer && (viewer.id === post.memberId || viewer.role === 'coach')
