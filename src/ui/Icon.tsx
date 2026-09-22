import type { CSSProperties, ReactElement, ReactNode, SVGProps } from 'react'
import { cx } from './cx'

/**
 * Night Session icon set: 24px viewBox, 1.8px stroke, round caps and joins, currentColor.
 * Only `play` and the video triangle are filled. Never emoji for UI.
 */
export const ICON_NAMES = [
  'home', 'train', 'body', 'fuel', 'squad', 'play', 'check', 'clock', 'list', 'flame', 'trophy',
  'calendar', 'calendar-check', 'bell', 'chevron-down', 'chevron-up', 'chevron-left', 'chevron-right', 'plus', 'minus', 'x',
  'video', 'file', 'external', 'arrow-up', 'arrow-down', 'arrow-right', 'history', 'bolt', 'more', 'swap', 'note',
  'target', 'machine', 'timer', 'message', 'sun', 'moon', 'monitor', 'settings', 'logout', 'edit', 'trash', 'upload',
  'download', 'link', 'share', 'copy', 'star', 'crown', 'medal', 'chart', 'scale', 'droplet', 'lock', 'eye', 'eye-off',
  'info', 'alert', 'user', 'user-plus', 'users', 'coach', 'whistle', 'sparkles', 'fist', 'heart', 'refresh', 'wifi-off',
  'cloud', 'search', 'filter', 'image', 'globe', 'dumbbell-plate', 'repeat', 'zap',
  // extras beyond the contract
  'arrow-left', 'plus-circle', 'check-circle', 'grip',
] as const

export type IconName = (typeof ICON_NAMES)[number]

export const isIconName = (v: unknown): v is IconName => typeof v === 'string' && (ICON_NAMES as readonly string[]).includes(v)

/** A small filled dot (list bullets, "more", info/alert points): independent of the stroke width. */
const Dot = ({ cx: x, cy: y, r = 1.25 }: { cx: number; cy: number; r?: number }) => (
  <circle cx={x} cy={y} r={r} fill="currentColor" stroke="none" />
)

/** Gear outline generated once: 8 teeth, rounded by the round line joins. */
function gearPath(): string {
  const n = 8
  const c = 12
  const rO = 9.4
  const rI = 7.1
  const step = (Math.PI * 2) / n
  const tw = step * 0.19
  const bw = step * 0.29
  const p = (r: number, a: number) => `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = i * step - Math.PI / 2
    d += `${i === 0 ? 'M' : 'L'}${p(rI, a - bw)}L${p(rO, a - tw)}A${rO} ${rO} 0 0 1 ${p(rO, a + tw)}L${p(rI, a + bw)}`
    d += `A${rI} ${rI} 0 0 1 ${p(rI, a + step - bw)}`
  }
  return d + 'Z'
}
const GEAR = gearPath()

const ICONS: Record<IconName, ReactNode> = {
  home: <path d="M4 10.2 12 4l8 6.2V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z" />,
  // dumbbell, side view: two big plates, collars and the bar
  train: (
    <>
      <rect x="5.4" y="5.5" width="3.6" height="13" rx="1.4" />
      <rect x="15" y="5.5" width="3.6" height="13" rx="1.4" />
      <path d="M5.4 9H4.2A1.2 1.2 0 0 0 3 10.2v3.6A1.2 1.2 0 0 0 4.2 15h1.2M18.6 9h1.2a1.2 1.2 0 0 1 1.2 1.2v3.6a1.2 1.2 0 0 1-1.2 1.2h-1.2M9 12h6" />
    </>
  ),
  // bathroom scale with a dial
  body: (
    <>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.8" />
      <path d="M7.6 11.2a4.4 4.4 0 0 1 8.8 0" />
      <path d="M12 11.2l2-2.4" />
    </>
  ),
  // fork + knife
  fuel: (
    <>
      <path d="M6.5 3.5v6.2a2 2 0 0 0 4 0V3.5M8.5 3.5v17" />
      <path d="M17.5 20.5v-17c-2.2 1.3-3.3 3.8-3.3 7v3.3h3.3" />
    </>
  ),
  // two people
  squad: (
    <>
      <circle cx="9" cy="8.2" r="3.4" />
      <path d="M3 19.5c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4" />
      <path d="M15.5 5a3.3 3.3 0 0 1 0 6.3M17.4 14.4c2 .6 3.2 2.3 3.6 5.1" />
    </>
  ),
  play: <path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.5-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor" stroke="none" />,
  check: <path d="M5 12.5l4.3 4.3L19 7.2" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  list: (
    <>
      <path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10" />
      <Dot cx={5} cy={6.5} />
      <Dot cx={5} cy={12} />
      <Dot cx={5} cy={17.5} />
    </>
  ),
  flame: (
    <>
      <path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-4.3-3.2-6.4-4.4-10.5-1.7 1.9-3.1 3.8-3.1 6.4-1.1-.5-1.9-1.6-2.1-3-1.7 1.7-3.4 4.2-3.4 7.1A6.5 6.5 0 0 0 12 21z" />
      <path d="M12 21c-1.7 0-3-1.3-3-3 0-1.9 1.6-2.8 2.2-4.6 1.5 1 3.8 2.3 3.8 4.6 0 1.7-1.3 3-3 3z" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 6H4.5a3.2 3.2 0 0 0 3.3 4.3M16.5 6h3a3.2 3.2 0 0 1-3.3 4.3M12 14v3.5M8 20.5h8M9.5 17.5h5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.8" y="5" width="16.4" height="15.2" rx="3.2" />
      <path d="M3.8 9.8h16.4M8.3 3v4M15.7 3v4" />
      <Dot cx={8.3} cy={13.6} r={1.05} />
      <Dot cx={12} cy={13.6} r={1.05} />
      <Dot cx={15.7} cy={13.6} r={1.05} />
      <Dot cx={8.3} cy={16.9} r={1.05} />
      <Dot cx={12} cy={16.9} r={1.05} />
    </>
  ),
  'calendar-check': (
    <>
      <rect x="3.8" y="5" width="16.4" height="15.2" rx="3.2" />
      <path d="M3.8 9.8h16.4M8.3 3v4M15.7 3v4M9 15l2 2 4-4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.8h-15z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  'chevron-down': <path d="M6.5 9.5l5.5 5.5 5.5-5.5" />,
  'chevron-up': <path d="M6.5 14.5 12 9l5.5 5.5" />,
  'chevron-left': <path d="M14.5 6.5 9 12l5.5 5.5" />,
  'chevron-right': <path d="M9.5 6.5 15 12l-5.5 5.5" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  minus: <path d="M5.5 12h13" />,
  x: <path d="M6.8 6.8l10.4 10.4M17.2 6.8 6.8 17.2" />,
  video: (
    <>
      <rect x="3.2" y="5.2" width="17.6" height="13.6" rx="3.8" />
      <path d="M10.3 9.3v5.4l4.5-2.7z" fill="currentColor" />
    </>
  ),
  file: (
    <>
      <path d="M13.8 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8.2z" />
      <path d="M13.8 3.5v4.7h4.7" />
    </>
  ),
  external: <path d="M14 4.5h5.5V10M19.5 4.5 11 13M17.5 14v3.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2H10" />,
  'arrow-up': <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />,
  'arrow-down': <path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" />,
  'arrow-right': <path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />,
  'arrow-left': <path d="M19 12H5M10.5 6.5 5 12l5.5 5.5" />,
  history: (
    <>
      <path d="M4.6 12a7.4 7.4 0 1 0 2.2-5.2" />
      <path d="M4.3 4.3v3.6h3.6" />
      <path d="M12 8v4.2l2.8 1.8" />
    </>
  ),
  bolt: <path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z" />,
  more: (
    <>
      <Dot cx={5.5} cy={12} r={1.6} />
      <Dot cx={12} cy={12} r={1.6} />
      <Dot cx={18.5} cy={12} r={1.6} />
    </>
  ),
  swap: <path d="M7 7.5h11.5l-3.2-3.2M17 16.5H5.5l3.2 3.2" />,
  note: (
    <>
      <path d="M5 4.5h14v10.5l-5 5H5z" />
      <path d="M14 20v-5h5M8.5 9h7M8.5 12.5h4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.6" />
      <Dot cx={12} cy={12} r={1.4} />
    </>
  ),
  // weight stack (machine)
  machine: (
    <>
      <rect x="5.5" y="3.5" width="13" height="4.2" rx="1.4" />
      <rect x="5.5" y="9.9" width="13" height="4.2" rx="1.4" />
      <rect x="5.5" y="16.3" width="13" height="4.2" rx="1.4" />
      <path d="M12 7.7v2.2M12 14.1v2.2" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7.3" />
      <path d="M12 13.5V9.8M9.5 2.8h5M18.4 6.9l1.4-1.4" />
    </>
  ),
  message: <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-8.2L6.5 20.3V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
    </>
  ),
  moon: <path d="M19.5 14.2A7.8 7.8 0 0 1 9.8 4.5a7.8 7.8 0 1 0 9.7 9.7z" />,
  monitor: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2.6" />
      <path d="M9 20.5h6M12 16.5v4" />
    </>
  ),
  settings: (
    <>
      <path d={GEAR} />
      <circle cx="12" cy="12" r="2.9" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
      <path d="M15 8l4 4-4 4M19 12H9.5" />
    </>
  ),
  edit: (
    <>
      <path d="M4.5 19.5l1-4.3L15.8 4.9a1.9 1.9 0 0 1 2.7 0l.6.6a1.9 1.9 0 0 1 0 2.7L8.8 18.5z" />
      <path d="M13.8 6.9l3.3 3.3" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
      <path d="M6.5 7l.8 11.6a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7M10 11v5.5M14 11v5.5" />
    </>
  ),
  upload: <path d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5M4.5 15v2.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V15" />,
  download: <path d="M12 4v11.5M7.5 11 12 15.5l4.5-4.5M4.5 15v2.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V15" />,
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </>
  ),
  share: <path d="M12 3.5v11M8 7.5l4-4 4 4M8.5 10.5H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
      <path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  star: <path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" />,
  crown: <path d="M4.5 17 3 7.5l5.2 4L12 5l3.8 6.5 5.2-4L19.5 17zM5 20.5h14" />,
  medal: (
    <>
      <circle cx="12" cy="15" r="5.5" />
      <path d="M8.4 10.9 6.3 3.5h3.8l1.9 5M15.6 10.9l2.1-7.4h-3.8l-1 2.7" />
      <path d="M11 13.6l1.2-.9v4.8" />
    </>
  ),
  chart: <path d="M4 20h16M7 16.5V12M12 16.5V6.5M17 16.5v-6" />,
  // digital bathroom scale (body is the analog dial)
  scale: (
    <>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.8" />
      <rect x="8.2" y="7.2" width="7.6" height="4" rx="1.4" />
      <Dot cx={8.4} cy={16.4} r={1.1} />
      <Dot cx={15.6} cy={16.4} r={1.1} />
    </>
  ),
  droplet: <path d="M12 3.5s6.2 6.3 6.2 10.9a6.2 6.2 0 0 1-12.4 0C5.8 9.8 12 3.5 12 3.5z" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.6" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.8 12S6.2 5.5 12 5.5 21.2 12 21.2 12 17.8 18.5 12 18.5 2.8 12 2.8 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M10.1 5.7a9.9 9.9 0 0 1 1.9-.2c5.8 0 9.2 6.5 9.2 6.5a16.6 16.6 0 0 1-2.4 3.2M6.6 6.9C4.2 8.6 2.8 12 2.8 12s3.4 6.5 9.2 6.5a9.3 9.3 0 0 0 5-1.4" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3.5 3.5l17 17" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2" />
      <Dot cx={12} cy={7.9} r={1.15} />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.4 3.2 17a2 2 0 0 0 1.7 3h14.2a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4" />
      <Dot cx={12} cy={16.8} r={1.15} />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.3" r="3.8" />
      <path d="M4.8 20c.8-3.8 3.6-6 7.2-6s6.4 2.2 7.2 6" />
    </>
  ),
  'user-plus': (
    <>
      <circle cx="10" cy="8.3" r="3.6" />
      <path d="M3.5 20c.8-3.8 3.4-6 6.5-6 1.6 0 3 .5 4.1 1.5M18.5 12.5v6M15.5 15.5h6" />
    </>
  ),
  // three people
  users: (
    <>
      <circle cx="12" cy="8.4" r="3.2" />
      <path d="M6.8 19.5c.5-3 2.6-4.9 5.2-4.9s4.7 1.9 5.2 4.9" />
      <path d="M6.4 5.7a2.6 2.6 0 0 0 0 5.1M2.6 17.6c.3-2 1.4-3.4 3.2-3.9M17.6 5.7a2.6 2.6 0 0 1 0 5.1M21.4 17.6c-.3-2-1.4-3.4-3.2-3.9" />
    </>
  ),
  // clipboard with a play diagram
  coach: (
    <>
      <path d="M8.8 4.5H7A2 2 0 0 0 5 6.5v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-12a2 2 0 0 0-2-2h-1.8" />
      <rect x="8.8" y="3" width="6.4" height="3.2" rx="1.1" />
      <path d="M8.6 10.2l2.4 2.4M11 10.2l-2.4 2.4M10 17.2c2.6.3 4.3-.8 5-3.2M13.6 14.4l1.5-.5.4 1.6" />
    </>
  ),
  whistle: (
    <>
      <path d="M9.5 8H20a1 1 0 0 1 1 1v1.8a1 1 0 0 1-1 1h-5.27A5.5 5.5 0 1 1 9.5 8z" />
      <circle cx="9.5" cy="13.5" r="1.6" />
    </>
  ),
  sparkles: (
    <>
      <path d="M10.5 3c.6 4.3 2.7 6.4 7 7-4.3.6-6.4 2.7-7 7-.6-4.3-2.7-6.4-7-7 4.3-.6 6.4-2.7 7-7z" />
      <path d="M18.5 15c.3 1.7 1.1 2.5 2.8 2.8-1.7.3-2.5 1.1-2.8 2.8-.3-1.7-1.1-2.5-2.8-2.8 1.7-.3 2.5-1.1 2.8-2.8z" />
    </>
  ),
  // fist, front view: four knuckles and the folded thumb
  fist: (
    <>
      <path d="M5.5 13.2V9.5a1.75 1.75 0 0 1 3.5 0V8.2a1.75 1.75 0 0 1 3.5 0v.3a1.75 1.75 0 0 1 3.5 0v1a1.75 1.75 0 0 1 3.5 0v4.3c0 3.7-2.7 6.7-6.6 6.7h-.8c-3.5 0-6.6-2.6-6.6-6.3z" />
      <path d="M5.5 12.8h5.8a1.7 1.7 0 0 1 0 3.4H9.2M9 9.5v3.3M12.5 8.5v4.3M16 9.5v3.3" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.4-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.6 12 20 12 20z" />,
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 0 1-13.1 5M4.5 12a7.5 7.5 0 0 1 13.1-5" />
      <path d="M17.8 3.5v3.7h-3.7M6.2 20.5v-3.7h3.7" />
    </>
  ),
  'wifi-off': (
    <>
      <path d="M8.6 15.3a5 5 0 0 1 5.4-.9M5.2 11.9a10 10 0 0 1 4.2-2.4M18.8 11.9a10 10 0 0 0-2.9-2M2 8.6a15 15 0 0 1 3.7-2.3M22 8.6a15 15 0 0 0-11.3-3.9M3.5 3.5l17 17" />
      <Dot cx={12} cy={18.6} r={1.25} />
    </>
  ),
  cloud: <path d="M7 18.5h10.5a4 4 0 0 0 .6-8 6 6 0 0 0-11.4-1.4A4.8 4.8 0 0 0 7 18.5z" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="M15.5 15.5 20 20" />
    </>
  ),
  filter: <path d="M4 7h16M7 12h10M10 17h4" />,
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <circle cx="9" cy="9.7" r="1.6" />
      <path d="M20.5 15.5 16 11l-8.5 8.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5z" />
    </>
  ),
  // weight plate: rim, hub and the grip slot
  'dumbbell-plate': (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M8.7 6.9a6.2 6.2 0 0 1 6.6 0" />
    </>
  ),
  repeat: <path d="M17 3.5l3 3-3 3M20 6.5H8a4 4 0 0 0-4 4v.5M7 20.5l-3-3 3-3M4 17.5h12a4 4 0 0 0 4-4V13" />,
  zap: <path d="M13.5 2.8 5 13.5h6.5l-1 7.7L19 10.5h-6.5z" />,
  'plus-circle': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.5 2.5 4.9-5.1" />
    </>
  ),
  grip: (
    <>
      <Dot cx={9} cy={7} r={1.3} />
      <Dot cx={15} cy={7} r={1.3} />
      <Dot cx={9} cy={12} r={1.3} />
      <Dot cx={15} cy={12} r={1.3} />
      <Dot cx={9} cy={17} r={1.3} />
      <Dot cx={15} cy={17} r={1.3} />
    </>
  ),
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'ref'> {
  name: IconName
  /** Rendered size in px (20 default; 16 inline meta; 12 inside pills; 22-24 primary actions). */
  size?: number
  /** Stroke width in viewBox units. Defaults to 1.8 (2.2 for icons 13px and smaller). */
  strokeWidth?: number
  className?: string
  /** Accessible name. Without it the icon is decorative (aria-hidden). */
  title?: string
  style?: CSSProperties
}

export function Icon({ name, size = 20, strokeWidth, className, title, ...rest }: IconProps): ReactElement {
  const sw = strokeWidth ?? (size <= 13 ? 2.2 : 1.8)
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx('ui-icon', className)}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {ICONS[name] ?? ICONS.info}
    </svg>
  )
}

/** Renders an IconName as <Icon/>, or passes a custom node through. */
export function renderIcon(icon: IconName | ReactNode | undefined, size?: number): ReactNode {
  if (icon == null || icon === false) return null
  return isIconName(icon) ? <Icon name={icon} size={size} /> : icon
}
