import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useMe } from '../../data/store'
import { useT } from '../../i18n'
import { fmtClock } from '../../lib/format'
import { FLOAT_PRIORITY, Icon, cx, useFloatingBar } from '../../ui'
import { useIsActiveHost, useNow } from './hooks'
import { adjustRest, restFraction, restRemaining, stopRest, useRest } from './logic/restTimer'
import { M } from './messages'
import './train.css'

/**
 * The live rest timer: a night-island bar floating above the tab bar. Its state lives in a module-level store
 * (logic/restTimer), so it keeps counting across screens. Mount it on the Train page; the app shell can also
 * mount `<RestTimerHost global />` to show it everywhere (only one host ever renders).
 * A timer belongs to the member who started it: signing out or switching profile stops it.
 */
export function RestTimerHost({ global = false }: { global?: boolean }) {
  const active = useIsActiveHost(global)
  const rest = useRest()
  const meId = useMe()?.id ?? null
  const foreign = !!rest && rest.memberId !== meId
  useEffect(() => {
    if (foreign) stopRest()
  }, [foreign])
  if (!active || !rest || foreign) return null
  return <RestTimerBar />
}

/** The 3 px volt line draining from its current share to zero (a CSS animation, no per-frame renders). */
function DrainLine({ endsAt, total }: { endsAt: number; total: number }) {
  const [anim] = useState(() => {
    const now = Date.now()
    return { from: restFraction({ endsAt, total }, now), ms: Math.max(0, endsAt - now) }
  })
  return <i className="tr-rest__fill" style={{ ['--from' as string]: String(anim.from), animationDuration: `${anim.ms}ms` }} />
}

function RestTimerBar() {
  const t = useT(M)
  const rest = useRest()
  const counting = !!rest && rest.zeroAt == null
  const now = useNow(counting ? 250 : 1000, !!rest)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const ref = useRef<HTMLDivElement>(null)
  // Stacks above other floating bars (the Body quick-log dock) instead of covering them; toasts sit above both.
  const offset = useFloatingBar(ref, FLOAT_PRIORITY.timer, !!rest)
  if (!rest) return null

  const left = restRemaining(rest, now)
  const over = rest.zeroAt != null
  const clock = fmtClock(left)
  const away = rest.route != null && pathname !== rest.route
  const body = (
    <>
      <p className="tr-rest__label">
        <Icon name="timer" size={12} strokeWidth={2.2} />
        {over ? t('restOver') : t('restOf', { t: fmtClock(rest.total) })}
      </p>
      <div className="tr-rest__main">
        <p className={cx('tr-rest__clock', over && 'is-go')} aria-hidden="true">
          {over ? t('go') : clock}
        </p>
        <p className="tr-rest__next">
          <span>{rest.next[0]}</span>
          <span className="tr-rest__next-v">{rest.next[1]}</span>
        </p>
      </div>
    </>
  )

  return (
    <div
      ref={ref}
      className={cx('tr-rest night', over && 'is-over')}
      style={{ ['--float-off' as string]: `${offset}px` }}
      role="timer"
      aria-label={over ? t('restDoneAria') : t('restAria', { t: clock })}
    >
      <div className="tr-rest__bar" aria-hidden="true">
        {over ? (
          <i className="tr-rest__fill is-full" />
        ) : (
          <DrainLine key={rest.endsAt} endsAt={rest.endsAt} total={rest.total} />
        )}
      </div>
      {away ? (
        <button type="button" className="tr-rest__text tr-rest__text--link" onClick={() => navigate(rest.route!)} aria-label={t('backToWorkout')}>
          {body}
        </button>
      ) : (
        <div className="tr-rest__text">{body}</div>
      )}
      <div className="tr-rest__btns">
        {!over ? (
          <button type="button" className="tr-rest__btn num" onClick={() => adjustRest(-15)} aria-label={t('minus15')}>
            −15
          </button>
        ) : null}
        <button type="button" className="tr-rest__btn num" onClick={() => adjustRest(30)} aria-label={t('plus30')}>
          +30
        </button>
        <button type="button" className="tr-rest__btn tr-rest__btn--x" onClick={() => stopRest()} aria-label={t('skipRest')}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <span className="visually-hidden" aria-live="polite">
        {over ? t('restDoneAria') : ''}
      </span>
    </div>
  )
}
