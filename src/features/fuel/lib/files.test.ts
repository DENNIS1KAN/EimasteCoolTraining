import { describe, expect, it } from 'vitest'
import { setLang } from '../../../i18n'
import { checkUpload, FILE_ACCEPT, fileExt, fileKind, fmtBytes, MAX_FILE_BYTES, orphanedFiles, uploadType } from './files'

describe('files', () => {
  it('detects kinds from type or extension', () => {
    expect(fileKind({ type: 'application/pdf', name: 'x' })).toBe('pdf')
    expect(fileKind({ type: '', name: 'Plan.PDF' })).toBe('pdf')
    expect(fileKind({ type: 'image/jpeg', name: 'x' })).toBe('image')
    expect(fileKind({ type: '', name: 'meal.heic' })).toBe('image')
    expect(fileKind({ type: 'text/plain', name: 'a.txt' })).toBe('other')
  })
  it('labels extensions', () => {
    expect(fileExt('a.jpeg')).toBe('JPG')
    expect(fileExt('plan.pdf')).toBe('PDF')
    expect(fileExt('noext')).toBe('')
  })
  it('checks uploads', () => {
    expect(checkUpload({ size: 100, type: 'application/pdf', name: 'a.pdf' })).toBeNull()
    expect(checkUpload({ size: MAX_FILE_BYTES + 1, type: 'image/png', name: 'a.png' })).toBe('tooLarge')
    expect(checkUpload({ size: 100, type: 'application/zip', name: 'a.zip' })).toBe('badType')
    expect(checkUpload({ size: 0, type: 'image/png', name: 'a.png' })).toBe('empty')
    // only what the meal-plans bucket accepts
    expect(checkUpload({ size: 100, type: 'image/avif', name: 'IMG_1.avif' })).toBe('badType')
    expect(checkUpload({ size: 100, type: 'image/svg+xml', name: 'logo.svg' })).toBe('badType')
    expect(checkUpload({ size: 100, type: 'image/bmp', name: 'scan.bmp' })).toBe('badType')
    expect(checkUpload({ size: 100, type: '', name: 'IMG_0001.HEIC' })).toBeNull()
  })
  it('formats sizes', () => {
    setLang('en')
    expect(fmtBytes(900)).toBe('900 B')
    expect(fmtBytes(84000)).toBe('82 KB')
    expect(fmtBytes(1.2 * 1024 * 1024)).toBe('1.2 MB')
    setLang('el')
    expect(fmtBytes(1.2 * 1024 * 1024)).toBe('1,2 MB')
    setLang('en')
  })
  it('keeps files another plan still uses', () => {
    const f = (path: string) => ({ path, name: path, type: 'application/pdf', size: 1 })
    const plans = [
      { id: 'a', files: [f('1'), f('2')] },
      { id: 'b', files: [f('2')] },
    ]
    expect(orphanedFiles([f('1'), f('2')], plans, 'a').map((x) => x.path)).toEqual(['1'])
  })
})

describe('uploadType', () => {
  it('matches the storage bucket allow-list', () => {
    expect(uploadType({ type: 'image/jpg', name: 'a.jpg' })).toBe('image/jpeg')
    expect(uploadType({ type: 'image/heif', name: 'a.heif' })).toBe('image/heic')
    expect(uploadType({ type: 'application/octet-stream', name: 'plan.PDF' })).toBe('application/pdf')
    expect(uploadType({ type: '', name: 'photo.webp' })).toBe('image/webp')
    expect(uploadType({ type: '', name: 'photo.avif' })).toBeNull()
    expect(uploadType({ type: 'image/avif', name: 'photo.jpg' })).toBeNull()
    expect(uploadType({ type: 'text/plain', name: 'a.txt' })).toBeNull()
  })
  it('lists the same types for the file picker', () => {
    const accept = FILE_ACCEPT.split(',')
    expect(accept).toContain('application/pdf')
    expect(accept).toContain('image/jpeg')
    expect(accept).not.toContain('image/*')
    // every type the picker offers passes the upload check
    for (const a of accept.filter((x) => x.includes('/'))) expect(uploadType({ type: a, name: 'x' })).toBe(a)
  })
})
