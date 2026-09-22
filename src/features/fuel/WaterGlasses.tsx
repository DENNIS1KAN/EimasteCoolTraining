import { useT } from '../../i18n'
import { fmtNum } from '../../lib/format'
import { glassCount, glassesOf, tapGlass, GLASS_L } from './lib/water'
import { FM } from './messages'

function Glass({ full }: { full: boolean }) {
  return (
    <svg className="fu-glass__svg" width="22" height="28" viewBox="0 0 22 28" aria-hidden="true" focusable="false">
      <path className="fu-glass__water" d="M4.3 9.5h13.4l-1.5 14.3a2 2 0 0 1-2 1.7H7.8a2 2 0 0 1-2-1.7z" style={{ opacity: full ? 1 : 0 }} />
      <path className="fu-glass__rim" d="M2.5 3h17l-2.2 20.9a2.4 2.4 0 0 1-2.4 2.1H7.1a2.4 2.4 0 0 1-2.4-2.1z" />
    </svg>
  )
}

export interface WaterGlassesProps {
  valueL: number | null
  targetL: number | null
  readOnly?: boolean
  onChange: (litres: number) => void
}

/** Tap a glass to fill up to it; tap the last full one again to undo. 0.25 L per glass. */
export function WaterGlasses({ valueL, targetL, readOnly, onChange }: WaterGlassesProps) {
  const t = useT(FM)
  const filled = glassesOf(valueL)
  const n = Math.max(glassCount(targetL), filled)
  const cols = n <= 7 ? n : n <= 14 ? Math.ceil(n / 2) : Math.ceil(n / 3)
  const target = targetL && targetL > 0 ? targetL : n * GLASS_L
  return (
    <div className="fu-water">
      <div className="fu-water__head">
        <h3 className="fu-sub">{t('water')}</h3>
        <span className="fu-water__v num" aria-live="polite">
          {t('waterValue', { n: fmtNum(filled * GLASS_L, 2), t: fmtNum(target, 2) })}
        </span>
      </div>
      <div className="fu-water__grid" role="group" aria-label={t('waterGroup')} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: n }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`fu-glass${i < filled ? ' is-full' : ''}`}
            aria-pressed={i < filled}
            aria-label={t('glass', { n: i + 1 })}
            disabled={readOnly}
            onClick={() => onChange(tapGlass(valueL, i))}
          >
            <Glass full={i < filled} />
          </button>
        ))}
      </div>
    </div>
  )
}
