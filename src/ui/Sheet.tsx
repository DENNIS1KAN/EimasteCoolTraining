import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { Button, IconButton } from './Button'
import { cx } from './cx'
import { UIM } from './messages'

/* Body scroll lock shared by every open sheet (nested sheets stack). */
let lockCount = 0
function lockScroll() {
  if (lockCount++ === 0) document.documentElement.classList.add('ui-scroll-locked')
}
function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) document.documentElement.classList.remove('ui-scroll-locked')
}

const FOCUSABLE =
  'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),' +
  'textarea:not([disabled]),iframe,audio[controls],video[controls],[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"])'

/** Exit animation length (ms); the sheet stays mounted this long after `open` turns false. */
export const SHEET_EXIT_MS = 220

export interface SheetProps {
  open: boolean
  /** Called on Esc, backdrop tap, the close button and swipe-down (when dismissible). */
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  /** Sticky footer, usually one or two block buttons. */
  footer?: ReactNode
  /** auto (fits content, default) or full (tall sheet / large dialog). */
  size?: 'auto' | 'full'
  /** Allow Esc, backdrop, swipe and the close button (default true). */
  dismissible?: boolean
  /** Accessible name when there is no visible title. */
  ariaLabel?: string
  /** Element to focus on open (default: [data-autofocus] inside, else the sheet itself). */
  initialFocus?: RefObject<HTMLElement | null>
  /** Called after the exit animation finished. */
  afterClose?: () => void
  className?: string
  children?: ReactNode
}

/**
 * Modal sheet: a bottom sheet with a grab handle on phones, a centered dialog at >= 700 px.
 * Focus moves in and is trapped, Esc/backdrop close, focus returns to the trigger, the page behind is scroll-locked.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  footer,
  size = 'auto',
  dismissible = true,
  ariaLabel,
  initialFocus,
  afterClose,
  className,
  children,
}: SheetProps) {
  const t = useT(UIM)
  const titleId = useId()
  const subId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)
  const [dragged, setDragged] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setClosing(!open)
    if (open) setDragged(false)
  }

  const afterCloseRef = useRef(afterClose)
  useEffect(() => {
    afterCloseRef.current = afterClose
  })

  useEffect(() => {
    if (!closing) return
    const id = window.setTimeout(() => {
      setClosing(false)
      afterCloseRef.current?.()
    }, SHEET_EXIT_MS)
    return () => window.clearTimeout(id)
  }, [closing])

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    lockScroll()
    const panel = panelRef.current
    if (panel) {
      panel.style.transform = ''
      panel.style.transition = ''
      if (!panel.contains(document.activeElement)) {
        const target = initialFocus?.current ?? panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel
        target.focus({ preventScroll: true })
      }
    }
    return () => {
      unlockScroll()
      if (prev && prev.isConnected) prev.focus({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const trapTab = (e: KeyboardEvent) => {
    const panel = panelRef.current
    if (!panel) return
    const els = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.closest('[inert]') && !el.closest('[aria-hidden="true"]') && el.tabIndex >= 0,
    )
    if (!els.length) {
      e.preventDefault()
      panel.focus()
      return
    }
    const first = els[0]
    const last = els[els.length - 1]
    const active = document.activeElement
    if (e.shiftKey) {
      if (active === first || active === panel || !panel.contains(active)) {
        e.preventDefault()
        last.focus()
      }
    } else if (active === last || !panel.contains(active)) {
      e.preventDefault()
      first.focus()
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      if (!dismissible || !open) return
      e.stopPropagation()
      e.preventDefault()
      onClose()
    } else if (e.key === 'Tab') {
      trapTab(e)
    }
  }

  /* swipe down on the handle/header to dismiss (phones only) */
  const drag = useRef<{ y: number; t: number; dy: number; id: number } | null>(null)
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!dismissible || e.button !== 0) return
    if ((e.target as HTMLElement).closest('button,a,input,select,textarea')) return
    if (window.matchMedia?.('(min-width: 700px)').matches) return
    drag.current = { y: e.clientY, t: performance.now(), dy: 0, id: e.pointerId }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const p = panelRef.current
    if (!d || !p || d.id !== e.pointerId) return
    d.dy = Math.max(0, e.clientY - d.y)
    p.style.transition = 'none'
    p.style.transform = `translateY(${d.dy}px)`
  }
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const p = panelRef.current
    drag.current = null
    if (!d || !p || d.id !== e.pointerId) return
    const velocity = d.dy / Math.max(1, performance.now() - d.t)
    p.style.transition = 'transform 200ms var(--ease)'
    if (d.dy > 110 || (d.dy > 36 && velocity > 0.6)) {
      setDragged(true)
      p.style.transform = 'translateY(110%)'
      onClose()
    } else {
      p.style.transform = ''
    }
  }

  if (!open && !closing) return null
  if (typeof document === 'undefined') return null

  const hasHead = title != null || subtitle != null || dismissible
  return createPortal(
    <div
      className={cx('ui-sheet-root', className)}
      data-state={open ? 'open' : 'closing'}
      data-size={size}
      data-dragged={dragged || undefined}
      aria-hidden={open ? undefined : true}
    >
      <div className="ui-sheet__scrim" aria-hidden="true" onClick={dismissible && open ? onClose : undefined} />
      <div
        ref={panelRef}
        className="ui-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title != null ? titleId : undefined}
        aria-label={title != null ? undefined : ariaLabel}
        aria-describedby={subtitle != null ? subId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div
          className={cx('ui-sheet__grab', dismissible && 'is-draggable')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <span className="ui-sheet__handle" aria-hidden="true" />
          {hasHead ? (
            <header className="ui-sheet__head">
              <div className="ui-sheet__titles">
                {title != null ? (
                  <h2 id={titleId} className="ui-sheet__title">
                    {title}
                  </h2>
                ) : null}
                {subtitle != null ? (
                  <p id={subId} className="ui-sheet__sub">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              {dismissible ? <IconButton icon="x" label={t('close')} size={36} className="ui-sheet__close" onClick={onClose} /> : null}
            </header>
          ) : null}
        </div>
        <div className="ui-sheet__body">{children}</div>
        {footer ? <div className="ui-sheet__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

export interface ConfirmSheetProps {
  open: boolean
  title: ReactNode
  body?: ReactNode
  confirmLabel: ReactNode
  cancelLabel?: ReactNode
  /** Destructive confirm button. */
  danger?: boolean
  /** May return a promise: the button shows a spinner until it settles; the sheet closes on success. */
  onConfirm: () => void | Promise<unknown>
  onClose: () => void
}

export function ConfirmSheet({ open, title, body, confirmLabel, cancelLabel, danger, onConfirm, onClose }: ConfirmSheetProps) {
  const t = useT(UIM)
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    try {
      const r = onConfirm()
      if (r && typeof (r as Promise<unknown>).then === 'function') {
        setBusy(true)
        await r
      }
      onClose()
    } catch {
      /* stay open so the caller can show an error */
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      dismissible={!busy}
      className="ui-confirm"
      footer={
        <>
          <Button variant="secondary" block onClick={onClose} disabled={busy} data-autofocus={danger ? true : undefined}>
            {cancelLabel ?? t('cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} block onClick={confirm} loading={busy} data-autofocus={danger ? undefined : true}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body ? <div className="ui-confirm__body">{body}</div> : null}
    </Sheet>
  )
}
