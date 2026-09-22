/**
 * Confetti burst on a throwaway <canvas>: volt plus the member colors, about 1.2 s, no dependencies.
 * No-op under prefers-reduced-motion, without a 2D canvas (tests) or during SSR.
 */
export interface CelebrateOptions {
  /** small: one burst from the lower middle (a set PR). big: two side cannons (a finished program week, a badge). */
  intensity?: 'small' | 'big'
  /** Override the palette (CSS colors). */
  colors?: string[]
}

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  tilt: number
  vt: number
  w: number
  h: number
  color: string
  shape: 0 | 1 | 2 // rect, strip, dot
}

const DURATION = 1200

function palette(): string[] {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  const volt = v('--accent', '#d4ff3f')
  // --ink is near-white at night and near-black by day, so the neutral pieces always read.
  return [volt, volt, volt, v('--m-blue', '#3987e5'), v('--m-orange', '#eb6834'), v('--m-aqua', '#1baf7a'), v('--ink', '#ffffff')]
}

export function celebrate(opts: CelebrateOptions = {}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    ctx = null
  }
  if (!ctx) return

  const big = opts.intensity === 'big'
  const colors = opts.colors?.length ? opts.colors : palette()
  const W = window.innerWidth
  const H = window.innerHeight
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'ui-confetti'
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 'var(--z-fx, 300)',
  })
  document.body.appendChild(canvas)
  ctx.scale(dpr, dpr)

  const rand = (a: number, b: number) => a + Math.random() * (b - a)
  const pieces: Piece[] = []
  const scale = Math.min(1.25, Math.max(0.8, H / 800))
  const spawn = (n: number, x: number, y: number, angle: number, spread: number, speed: [number, number]) => {
    for (let i = 0; i < n; i++) {
      const a = angle + rand(-spread, spread)
      const s = rand(speed[0], speed[1]) * scale
      const shape = (Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : 2) as Piece['shape']
      pieces.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.25, 0.25),
        tilt: rand(0, Math.PI * 2),
        vt: rand(0.08, 0.2),
        w: shape === 1 ? rand(3, 4) : rand(6, 10),
        h: shape === 1 ? rand(10, 15) : rand(4, 7),
        color: colors[(Math.random() * colors.length) | 0],
        shape,
      })
    }
  }
  const up = -Math.PI / 2
  if (big) {
    spawn(90, -10, H * 0.72, up + 0.62, 0.34, [13, 22])
    spawn(90, W + 10, H * 0.72, up - 0.62, 0.34, [13, 22])
    spawn(40, W / 2, H * 0.62, up, 0.75, [9, 17])
  } else {
    spawn(70, W / 2, H * 0.66, up, 0.62, [9, 16])
  }

  const start = performance.now()
  let last = start
  const c = ctx
  const frame = (now: number) => {
    const t = (now - start) / DURATION
    const dt = Math.min(2.5, (now - last) / 16.67)
    last = now
    c.clearRect(0, 0, W, H)
    const alpha = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3)
    for (const p of pieces) {
      p.vy += 0.36 * dt
      p.vx *= Math.pow(0.985, dt)
      p.vy *= Math.pow(0.985, dt)
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      p.tilt += p.vt * dt
      if (p.y > H + 20) continue
      c.save()
      c.globalAlpha = alpha
      c.translate(p.x, p.y)
      c.rotate(p.rot)
      c.scale(1, Math.cos(p.tilt))
      c.fillStyle = p.color
      if (p.shape === 2) {
        c.beginPath()
        c.arc(0, 0, p.w / 2.2, 0, Math.PI * 2)
        c.fill()
      } else {
        c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      }
      c.restore()
    }
    if (t < 1) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
