import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { CheerInbox } from '../squad/CheerInbox'

/**
 * The CheerInbox in a focusable slot, and the bell's action: jump to the inbox when it has something,
 * otherwise open the squad feed.
 */
export function useInboxSlot(unseen: number) {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const onBell = useCallback(() => {
    const el = ref.current
    if (!unseen || !el || !el.firstElementChild) {
      navigate('/squad?tab=feed')
      return
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
    el.classList.remove('is-flash')
    // restart the highlight animation
    void el.offsetWidth
    el.classList.add('is-flash')
  }, [unseen, navigate])
  const slot = (
    <div ref={ref} id="home-inbox" className="home-inbox" tabIndex={-1} onAnimationEnd={() => ref.current?.classList.remove('is-flash')}>
      <CheerInbox />
    </div>
  )
  return { slot, onBell }
}
