/**
 * Rest timer state, kept at module level so it survives navigation inside the app (the timer keeps running
 * while you look at the squad feed between sets). The alarm is scheduled here too, not in a component, so it
 * still beeps and vibrates when the timer isn't on screen.
 */
import { useSyncExternalStore } from 'react'
import { getPrefs } from '../../../lib/prefs'

export interface RestState {
  /** Increments on every start (restarts the slide-in and the progress line). */
  id: number
  startedAt: number
  endsAt: number
  /** Full length in ms (grows with +30 s so the progress line stays meaningful). */
  total: number
  /** "Next" caption, two short lines. */
  next: [string, string]
  /** Where the workout lives, so the timer can take you back to it. */
  route: string | null
  /** When the countdown reached zero (null while counting). */
  zeroAt: number | null
}

/** The "GO" state stays up this long before the timer hides itself. */
export const AUTO_HIDE_MS = 2 * 60 * 1000

let state: RestState | null = null
let seq = 0
let zeroTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function emit(next: RestState | null) {
  state = next
  listeners.forEach((f) => f())
}

function clearTimers() {
  if (zeroTimer) clearTimeout(zeroTimer)
  if (hideTimer) clearTimeout(hideTimer)
  zeroTimer = hideTimer = null
}

function schedule(now: number) {
  clearTimers()
  if (!state) return
  if (state.zeroAt == null) {
    zeroTimer = setTimeout(() => reachZero(Date.now()), Math.max(0, state.endsAt - now))
  } else {
    hideTimer = setTimeout(() => stopRest(), Math.max(0, state.zeroAt + AUTO_HIDE_MS - now))
  }
}

function reachZero(now: number) {
  if (!state || state.zeroAt != null) return
  emit({ ...state, zeroAt: now })
  schedule(now)
  alarm()
}

export const getRest = (): RestState | null => state

export function subscribeRest(f: () => void): () => void {
  listeners.add(f)
  return () => listeners.delete(f)
}

export const useRest = (): RestState | null => useSyncExternalStore(subscribeRest, getRest, getRest)

/** Start (or restart) the rest countdown. Call from the tap that ticked the set, so audio can unlock. */
export function startRest(p: { seconds: number; next: [string, string]; route?: string | null }, now = Date.now()): void {
  unlockAudio()
  const total = Math.max(1, Math.round(p.seconds)) * 1000
  emit({ id: ++seq, startedAt: now, endsAt: now + total, total, next: p.next, route: p.route ?? null, zeroAt: null })
  schedule(now)
}

/** −15 s / +30 s. Adding time after zero starts a fresh countdown of that length. */
export function adjustRest(deltaSec: number, now = Date.now()): void {
  if (!state) return
  const delta = deltaSec * 1000
  if (state.zeroAt != null) {
    if (delta <= 0) return
    emit({ ...state, startedAt: now, endsAt: now + delta, total: delta, zeroAt: null })
    schedule(now)
    return
  }
  const endsAt = Math.max(now, state.endsAt + delta)
  const total = delta > 0 ? state.total + delta : state.total
  emit({ ...state, endsAt, total })
  if (endsAt <= now) reachZero(now)
  else schedule(now)
}

export function stopRest(): void {
  clearTimers()
  if (state) emit(null)
}

/** Remaining ms (0 once time is up). */
export const restRemaining = (s: Pick<RestState, 'endsAt'>, now: number): number => Math.max(0, s.endsAt - now)

/** Share of the rest still to go, 1 -> 0 (the progress line drains). */
export const restFraction = (s: Pick<RestState, 'endsAt' | 'total'>, now: number): number => (s.total > 0 ? Math.min(1, restRemaining(s, now) / s.total) : 0)

/* ------------------------------------------------------------------ alarm */

type AudioCtor = typeof AudioContext
let audio: AudioContext | null = null

function audioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** iOS only lets audio start from a user gesture, so the context is created/resumed on the tick. */
function unlockAudio() {
  if (!getPrefs().restSound) return
  try {
    const Ctor = audioCtor()
    if (!Ctor) return
    audio ??= new Ctor()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}

/** Three short rising beeps. */
function beep() {
  try {
    const ctx = audio
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    const t0 = ctx.currentTime + 0.02
    ;[0, 0.22, 0.44].forEach((dt, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = i === 2 ? 1175 : 880
      gain.gain.setValueAtTime(0.0001, t0 + dt)
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + (i === 2 ? 0.32 : 0.16))
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0 + dt)
      osc.stop(t0 + dt + 0.36)
    })
  } catch {
    /* audio is a nicety */
  }
}

function alarm() {
  const p = getPrefs()
  if (p.restSound) beep()
  if (p.restVibrate) {
    try {
      navigator.vibrate?.([220, 120, 220, 120, 380])
    } catch {
      /* unsupported */
    }
  }
}
