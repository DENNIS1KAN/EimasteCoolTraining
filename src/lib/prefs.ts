import { useSyncExternalStore } from 'react'

/**
 * Per-device preferences (not synced): things that depend on the phone rather than the person.
 * Profile-level settings (units, weight privacy, remembered machines) live in Member.settings instead.
 */
export interface DevicePrefs {
  /** Beep when the rest timer ends. */
  restSound: boolean
  /** Vibrate when the rest timer ends (Android; iOS ignores it). */
  restVibrate: boolean
  /** Keep the screen awake while a workout is in progress. */
  keepAwake: boolean
  /** Dismissed one-time hints, by id. */
  dismissed: Record<string, true>
}

const KEY = 'ect-prefs-v1'
const DEFAULTS: DevicePrefs = { restSound: true, restVibrate: true, keepAwake: true, dismissed: {} }
const listeners = new Set<() => void>()

function read(): DevicePrefs {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

let prefs: DevicePrefs = read()

export const getPrefs = (): DevicePrefs => prefs

export function setPref<K extends keyof DevicePrefs>(key: K, value: DevicePrefs[K]): void {
  prefs = { ...prefs, [key]: value }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
  listeners.forEach((f) => f())
}

export const dismissHint = (id: string): void => setPref('dismissed', { ...prefs.dismissed, [id]: true })
export const isHintDismissed = (id: string): boolean => !!prefs.dismissed[id]

export function usePrefs(): DevicePrefs {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    getPrefs,
    getPrefs,
  )
}
