import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText, inviteLink, shareOrCopy } from './invite'

describe('inviteLink', () => {
  it('builds a hash-route join link on the current app location', () => {
    expect(inviteLink({ origin: 'https://x.github.io', pathname: '/ect/' }, 'stelios', 'AB12CD')).toBe(
      'https://x.github.io/ect/#/join/stelios?code=AB12CD',
    )
  })
  it('encodes unusual characters', () => {
    expect(inviteLink({ origin: 'http://localhost:5173', pathname: '/' }, 'a b', 'X&Y')).toBe('http://localhost:5173/#/join/a%20b?code=X%26Y')
  })
})

describe('shareOrCopy', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses the Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } })
    await expect(shareOrCopy({ title: 't', text: 'hello' })).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 't', text: 'hello' })
  })

  it('reports a cancelled share without copying', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new DOMException('no', 'AbortError')), clipboard: { writeText } })
    await expect(shareOrCopy({ title: 't', text: 'hello' })).resolves.toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('falls back to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(shareOrCopy({ title: 't', text: 'hello' })).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('copyText reports failure when nothing works', async () => {
    vi.stubGlobal('navigator', {})
    const exec = vi.fn().mockReturnValue(false)
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
    await expect(copyText('x')).resolves.toBe(false)
  })
})
