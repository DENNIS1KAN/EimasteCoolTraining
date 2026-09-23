import { useEffect, useState } from 'react'
import { getBackend } from '../../../data/store'
import type { FileRef } from '../../../data/types'
import { useT } from '../../../i18n'
import { SQ } from '../messages'

/**
 * Photos on a post. Urls are resolved lazily (Supabase signs them; demo mode makes object urls), so a long
 * stream doesn't sign every image it has ever shown.
 */
export function PhotoGrid({ photos }: { photos: FileRef[] }) {
  const t = useT(SQ)
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    const backend = getBackend()
    void Promise.all(
      photos.map(async (p) => {
        try {
          return [p.path, await backend.fileUrl(p)] as const
        } catch {
          return null
        }
      }),
    ).then((pairs) => {
      if (alive) setUrls(Object.fromEntries(pairs.filter(Boolean) as (readonly [string, string])[]))
    })
    return () => {
      alive = false
    }
  }, [photos])

  if (!photos.length) return null
  return (
    <ul className={`sq-photos sq-photos--${Math.min(photos.length, 4)}`}>
      {photos.map((p) => (
        <li key={p.path}>
          {urls[p.path] ? (
            <a href={urls[p.path]} target="_blank" rel="noreferrer">
              <img src={urls[p.path]} alt={t('photoAlt')} loading="lazy" />
            </a>
          ) : (
            <span className="sq-photos__ph" aria-hidden="true" />
          )}
        </li>
      ))}
    </ul>
  )
}
