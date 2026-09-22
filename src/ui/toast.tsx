import { useSyncExternalStore } from 'react'
import { useT } from '../i18n'
import { cx } from './cx'
import { Icon } from './Icon'
import { UIM } from './messages'

export type ToastTone = 'default' | 'good' | 'danger'

export interface ToastOptions {
  tone?: ToastTone
  action?: { label: string; onClick: () => void }
  /** ms before it hides (default 3500, 6000 with an action). 0 = stays until dismissed. */
  duration?: number
}

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  action?: { label: string; onClick: () => void }
  leaving: boolean
}

const MAX_VISIBLE = 3
const LEAVE_MS = 200
let items: ToastItem[] = []
let seq = 0
const listeners = new Set<() => void>()
const timers = new Map<number, number>()
const emit = () => listeners.forEach((f) => f())

/** Show a toast. Returns its id (for dismissToast). */
export function toast(message: string, opts: ToastOptions = {}): number {
  const id = ++seq
  const item: ToastItem = { id, message, tone: opts.tone ?? 'default', action: opts.action, leaving: false }
  items = [...items, item]
  emit()
  // Too many: the oldest ones leave.
  const active = items.filter((t) => !t.leaving)
  active.slice(0, Math.max(0, active.length - MAX_VISIBLE)).forEach((t) => scheduleRemove(t.id, 0))
  const duration = opts.duration ?? (opts.action ? 6000 : 3500)
  if (duration > 0 && typeof window !== 'undefined') timers.set(id, window.setTimeout(() => dismissToast(id), duration))
  return id
}

function scheduleRemove(id: number, delay: number) {
  window.clearTimeout(timers.get(id))
  timers.delete(id)
  const run = () => {
    items = items.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    emit()
    window.setTimeout(() => {
      items = items.filter((t) => t.id !== id)
      emit()
    }, LEAVE_MS)
  }
  if (delay > 0) timers.set(id, window.setTimeout(run, delay))
  else run()
}

export function dismissToast(id: number): void {
  if (!items.some((t) => t.id === id && !t.leaving)) return
  scheduleRemove(id, 0)
}

export function clearToasts(): void {
  timers.forEach((t) => window.clearTimeout(t))
  timers.clear()
  items = []
  emit()
}

const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => {
    listeners.delete(f)
  }
}
const snapshot = () => items

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/** Mount once (AppShell). Toasts float above the tab bar, dark "night" pills in both themes. */
export function Toaster() {
  const list = useToasts()
  const t = useT(UIM)
  return (
    <div className="ui-toaster" role="region" aria-label={t('notifications')}>
      <div className="ui-toaster__live" aria-live="polite" aria-relevant="additions text">
        {list.map((it) => (
          <div
            key={it.id}
            className={cx('ui-toast night', `ui-toast--${it.tone}`, it.leaving && 'is-leaving')}
            role={it.tone === 'danger' ? 'alert' : 'status'}
          >
            {it.tone !== 'default' ? (
              <span className="ui-toast__icon">
                <Icon name={it.tone === 'good' ? 'check-circle' : 'alert'} size={20} />
              </span>
            ) : null}
            <p className="ui-toast__msg">{it.message}</p>
            {it.action ? (
              <button
                type="button"
                className="ui-toast__action"
                onClick={() => {
                  it.action?.onClick()
                  dismissToast(it.id)
                }}
              >
                {it.action.label}
              </button>
            ) : null}
            <button type="button" className="ui-toast__close" aria-label={t('dismiss')} onClick={() => dismissToast(it.id)}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
