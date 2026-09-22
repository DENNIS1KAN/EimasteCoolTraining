# UI kit contract (`src/ui`)

The visual language is **Night Session**. The reference mockup is `design/mockups/night-session/` (`index.html`, `SPEC.md`, screenshots).
Everything imports from `src/ui` (the barrel `src/ui/index.ts`) and the chart kit from `src/ui/charts`.
Features must **not** hardcode colors, fonts, radii or shadows. They use the tokens below and these components.
Put feature-specific CSS in the feature's own `*.css` file, next to its components, and build it from tokens.

## Tokens (`src/styles/tokens.css`)

| Purpose | Tokens |
| --- | --- |
| page and surfaces | `--bg`, `--bg-glow`, `--surface` (cards), `--surface-2` (inputs, tracks), `--surface-3` (pressed, progress tracks), `--seg-on`, `--card-border` |
| lines | `--line` (hairline), `--line-strong` |
| ink | `--ink` (primary), `--ink-2` (secondary), `--muted` (labels, eyebrows, axis), `--faint` (placeholders, e.g. last time's numbers) |
| accent: volt | `--accent` (fill), `--on-accent` (text and icons on volt), `--accent-strong` (volt as a stroke or text on a surface: black in light mode), `--accent-soft` (highlighter band), `--accent-glow` (colored shadow) |
| status (always paired with an icon or label) | `--good`/`--good-soft`, `--warn`/`--warn-soft`, `--danger`/`--danger-soft` |
| members | `--m-blue` (Stelios), `--m-orange` (Thanos), `--m-aqua` (Dennis), plus `--m-yellow`, `--m-magenta`, `--m-green`, `--m-violet`, `--m-red`. Use `memberColorVar(member.color)` from `src/ui/member.ts` |
| charts | `--grid`, `--axis` |
| type | `--font-display` (Sofia Sans Extra Condensed: numerals, screen titles, greeting), `--font-body` (Manrope: all UI text) |
| shape | `--r-xs` 7, `--r-sm` 10, `--r-md` 14, `--r-lg` 18, `--r-xl` 22, `--r-2xl` 26, `--r-pill` |
| elevation | `--shadow-1` (cards), `--shadow-2` (floating: sheets, timer, dock) |
| spacing | `--s-1` … `--s-10` (4 px grid) |
| motion | `--ease`, `--dur-1`, `--dur-2` |
| layout | `--gutter` (16), `--tabbar-h`, `--content-max`, `--safe-top`, `--safe-bottom` |

The `.night` class forces the dark "night island" palette inside any element, in both themes. It is used by the hero workout card and the rest timer.

Utility classes (`src/styles/base.css`):

- **layout:** `.stack` (vertical flex, gap 10) / `.stack-sm` / `.stack-lg`, `.row` (horizontal flex, center, gap 8), `.row-between`, `.grid-2`, `.grid-3` (gap 10), `.spacer` (flex 1)
- **type:** `.eyebrow` (11 px, 800, uppercase, tracking .1em, `--muted`), `.micro` (9.5 px uppercase label), `.num` (display font with tabular lining numerals), `.muted`, `.ink-2`, `.nowrap`, `.truncate`, `.visually-hidden`

## Components (all exported from `src/ui/index.ts`)

```ts
// Icons: 24px viewBox, 1.8px stroke, currentColor. Never emoji for UI.
type IconName = 'home' | 'train' | 'body' | 'fuel' | 'squad' | 'play' | 'check' | 'clock' | 'list' | 'flame' | 'trophy'
  | 'calendar' | 'calendar-check' | 'bell' | 'chevron-down' | 'chevron-up' | 'chevron-left' | 'chevron-right' | 'plus' | 'minus' | 'x'
  | 'video' | 'file' | 'external' | 'arrow-up' | 'arrow-down' | 'arrow-right' | 'history' | 'bolt' | 'more' | 'swap' | 'note'
  | 'target' | 'machine' | 'timer' | 'message' | 'sun' | 'moon' | 'monitor' | 'settings' | 'logout' | 'edit' | 'trash' | 'upload'
  | 'download' | 'link' | 'share' | 'copy' | 'star' | 'crown' | 'medal' | 'chart' | 'scale' | 'droplet' | 'lock' | 'eye' | 'eye-off'
  | 'info' | 'alert' | 'user' | 'user-plus' | 'users' | 'coach' | 'whistle' | 'sparkles' | 'fist' | 'heart' | 'refresh' | 'wifi-off'
  | 'cloud' | 'search' | 'filter' | 'image' | 'globe' | 'dumbbell-plate' | 'repeat' | 'zap'
<Icon name="trophy" size={20} strokeWidth={1.8} className? title? />   // aria-hidden unless title

<Button variant="primary" | "secondary" | "ghost" | "tonal" | "danger" size="sm" | "md" | "lg" icon? iconRight? loading? block? {...buttonProps}>
<ButtonLink to="/train" variant size icon block>   // react-router Link styled as a button
<IconButton icon="more" label="More options" variant="soft" | "ghost" | "outline" size={44 | 36} badge?: boolean | number {...buttonProps} />

<Card as?="section" padding?="md" | "sm" | "none" interactive? to? onClick? className?>   // `to` makes the whole card a link
<CardHeader title="Squad pulse" subtitle? eyebrow? action?={<Link …>} />   // section title + right link
<PageHeader eyebrow?="THU 24 SEP · WEEK 3 OF 12" title="Squad" subtitle? back?={true | '/path'} actions?={ReactNode} account?={true} />
   // big condensed uppercase screen title (or greeting); `account` renders the viewer's avatar button, which opens the account sheet
<SectionTitle title eyebrow? action? />

<Avatar member={{ name, color }} size={24 | 32 | 40 | 54 | 80} ring? you? />      // initials on a member-color gradient
<AvatarStack members={[...]} size={32} max={4} />
<MemberName member />   // name followed by a small color dot (text stays ink)

<StatTile label="Week streak" value="3" unit="wk" icon?="flame" delta?={{ text: '1.5 kg', dir: 'down' | 'up' | 'flat', tone: 'good' | 'warn' | 'neutral' }} trend?={ReactNode} to? />
<BigNumber value="80.9" unit="kg" size="xxl" | "xl" | "lg" | "md" />   // display numerals with a small unit
<Delta text="1.5 kg" dir="down" tone="good" />                         // arrow pill (status colors + icon)

<Chip selected? icon? onClick? tone?="default" | "accent" size?="sm" | "md">Aim 57.5 kg</Chip>
<Tag tone="neutral" | "accent" | "good" | "warn" | "danger" | "solid" icon?>LAST SET · FAILURE</Tag>   // micro uppercase tag
<PRBadge />   // volt "PR" badge with a trophy icon
<Segmented options={[{ value, label, sub?, icon? }]} value onChange size?="md" | "sm" | "lg" ariaLabel block? />
<Tabs … />   // alias of Segmented, for page-level tabs

<Sheet open onClose title? subtitle? footer? size?="auto" | "full" dismissible?={true}>…</Sheet>
   // bottom sheet on phones, centered dialog at ≥ 700px; focus trap; Esc and backdrop close; restores focus; scroll-locks the body
<ConfirmSheet open title body confirmLabel danger? onConfirm onClose />

<TextField label hint? error? {...inputProps} />
<NumberField label? value onChange(valueString) decimals?={1} min? max? suffix?="kg" />   // accepts a comma, inputMode="decimal"
<TextArea label hint? rows? {...textareaProps} />
<Select label options={[{ value, label }]} value onChange />
<Switch checked onChange label description? />
<Stepper value={number} onChange step={0.1} min max format?={(n) => string} unit? size?="lg" />   // big −/+ control for logging weight
<DateField label value="YYYY-MM-DD" onChange max? />
<FileDrop accept="application/pdf,image/*" multiple? onFiles={(files: File[]) => void} label hint />

<ProgressBar value={0..1} color?={cssColor} height?={6} label? />
<WeekDots items={[{ label: 'U', state: 'done' | 'today' | 'upcoming' | 'missed' }]} size?={23} />
<EmptyState icon title body? action? />
<Banner tone="info" | "warn" | "danger" | "accent" icon? action?>…</Banner>
<Skeleton width height radius />
<Spinner size />

toast(message: string, opts?: { tone?: 'default' | 'good' | 'danger'; action?: { label, onClick }; duration?: number })   // + <Toaster/> mounted by AppShell
celebrate(opts?: { intensity?: 'small' | 'big' })   // volt and member-color confetti burst; no-op under prefers-reduced-motion
useMediaQuery(query: string): boolean
useWakeLock(active: boolean)   // keeps the screen on while a workout is in progress (Screen Wake Lock API; silently no-op when unsupported)
```

The account sheet, bottom tab bar, desktop sidebar, offline/demo/sync banners and `<Toaster/>` all live in `src/app/AppShell.tsx`.
Pages render **inside** the shell: a scroll container with the gutter, the safe areas and space for the tab bar already applied.
A page is usually `<PageHeader …/>` followed by a `.stack` of cards.
Fixed bottom UI (the rest timer or the quick-log dock) must sit above the tab bar: `bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 8px)`.
On desktop (≥ 1024 px) the tab bar becomes a left sidebar and `--tabbar-h` is 0.
