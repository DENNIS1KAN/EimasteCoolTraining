import type { CSSProperties } from 'react'
import type { Member } from '../../data/types'
import { useT } from '../../i18n'
import { Icon, memberColorVar } from '../../ui'
import { M } from './messages'

/** A faint preview of the chart to come: daily dots around a gently falling trend. */
const GHOST_DOTS: [number, number][] = [
  [4, 12],
  [28, 22],
  [52, 14],
  [76, 26],
  [100, 20],
  [124, 33],
  [148, 25],
  [172, 38],
  [196, 31],
  [220, 43],
  [244, 38],
  [268, 49],
  [292, 44],
]

/** First-run hero: what to do (log below) and a ghosted chart hinting at what appears here. */
export function EmptyHero({ member, wide = false }: { member: Member; wide?: boolean }) {
  const t = useT(M)
  return (
    <section
      className="body-empty-hero"
      aria-labelledby="body-empty-title"
      style={{ ['--hero-c' as string]: memberColorVar(member.color) } as CSSProperties}
    >
      <span className="body-empty-hero__icon" aria-hidden="true">
        <Icon name="scale" size={24} />
      </span>
      <h2 className="body-empty-hero__title" id="body-empty-title">
        {t('emptyTitle')}
      </h2>
      <p className="body-empty-hero__body">{t(wide ? 'emptyBodyWide' : 'emptyBody')}</p>
      <svg className="body-empty-hero__ghost" viewBox="0 0 320 64" aria-hidden="true" focusable="false">
        <path className="body-empty-hero__ghost-line" d="M4 16 C 60 18, 90 22, 130 28 S 210 40, 250 44 S 300 50, 316 51" />
        {GHOST_DOTS.map(([x, y]) => (
          <circle key={x} className="body-empty-hero__ghost-dot" cx={x} cy={y} r="3" />
        ))}
        <circle className="body-empty-hero__ghost-end" cx="316" cy="51" r="5" />
      </svg>
    </section>
  )
}
