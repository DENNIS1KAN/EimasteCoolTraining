# Night Session: design system spec

Direction for **Eimaste Cool Training** (Είμαστε Cool). The app is dark-first and premium-athletic, meant for training at night: near-black blue-tinted surfaces, a single volt accent for action, huge condensed numerals, and member colors kept for identity only. In the light theme ("daylight gym") the page is bright white with black-ink strokes and volt highlighter. The hero card and the live rest timer stay dark in light mode. This is intentional and uses the `.night` island.

Reference implementation: `index.html` (tokens at the top of `<style>`). Screenshots: `shot-dark.png` and `shot-light.png`.

---

## 1. Color tokens

Define all tokens as CSS custom properties on `:root`. Dark values go in two places:
`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` and `:root[data-theme="dark"] {…}`.
`body` always gets an explicit `background: var(--page)`, and the app shell uses `var(--bg)`.

### Surfaces and ink

| Token | Light (daylight gym) | Dark (night session) | Use |
|---|---|---|---|
| `--bg` | `#F3F5F8` | `#07090F` | app background |
| `--bg-glow` | transparent | `rgba(57,135,229,.10)` | 420×300 radial glow, top-right of the screen, tinted with the viewer's member color |
| `--surface-1` | `#FFFFFF` | `#0E121B` | cards, tiles, sheets |
| `--surface-2` | `#F0F2F6` | `#151A25` | inputs, chips, segmented track, spec strip |
| `--surface-3` | `#E4E8EE` | `#1D2331` | progress tracks, pressed, leader pill |
| `--seg-on` | `#FFFFFF` | `#262D3D` | selected segment |
| `--hairline` | `#E5E8EE` | `#1A1F2B` | dividers (1px) |
| `--hairline-strong` | `#D3D9E2` | `#283042` | outlines, ghost buttons, empty rings |
| `--grid` | `#E8EBF0` | `#171C28` | chart gridlines |
| `--card-border` | `rgba(16,24,40,.045)` | `rgba(140,160,205,.075)` | 1px card border |
| `--ink-1` | `#0B1020` | `#F3F6FB` | primary text, numerals |
| `--ink-2` | `#4A5467` | `#A2ACBE` | secondary text, macro bars |
| `--ink-3` | `#737D91` | `#6C768A` | labels, axis text, eyebrows (≥3.9:1 on surface-1) |
| `--ink-ph` | `#8A93A3` | `#5E6779` | input placeholders, e.g. last time's values (≈3:1) |
| `--tabbar` | `rgba(255,255,255,.93)` | `rgba(9,12,19,.93)` | tab bar, with `backdrop-filter: blur(22px) saturate(1.5)` |

### Brand accent: Volt (one accent only)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--accent` | `#D4FF3F` | `#D4FF3F` | primary button fill, current-week chip, active tab pill, done checks, PR badge |
| `--accent-ink` | `#0B1020` | `#0A0E02` | text and icons on volt (16:1) |
| `--accent-strong` | `#0B1020` | `#D4FF3F` | accent strokes on surfaces: progress rings, focus rings, completion bars, live dot. On light this is ink-black, because volt on white is only 1.1:1 |
| `--accent-soft` | `rgba(212,255,63,.34)` | `rgba(212,255,63,.11)` | highlighter rows: completed PR set, "Next" meal, "Aim" chip, my reaction |
| `--accent-glow` | `rgba(150,200,0,.45)` | `rgba(212,255,63,.28)` | colored drop shadow under volt fills |

Volt (hue ≈75°, very high lightness) sits between the orange and aqua member hues but is much lighter than both. It is used only as a fill or highlight and never as a data series, so it can't be confused with a member.

### Member identity (FIXED, validated as a set; do not add hues)

| Member | Light | Dark |
|---|---|---|
| Stelios | `--m-stelios: #2a78d6` | `#3987e5` |
| Thanos | `--m-thanos: #eb6834` | `#d95926` |
| Dennis (coach) | `--m-dennis: #1baf7a` | `#199e70` |

Validator: all checks pass in light (on #fff) and in dark (on #0E121B). Worst CVD ΔE is 9.2 (aqua↔orange, deutan). Aqua on white is 2.8:1, so it always carries a visible label (name or initial).
Rules: text never wears a member color. Identity comes from avatars, chart marks, the dot or swatch in a legend, and bars. Values and labels stay in ink tokens.
A viewer's own series (weight, sparkline) uses their member color. Progress toward their own targets (rings, heatmap, checks) uses the accent.

### Status (distinct from member hues; always icon + label)

| Token | Light | Dark | Paired with |
|---|---|---|---|
| `--good` / `--good-soft` | `#4F7F00` / `rgba(79,127,0,.11)` | `#C5F24A` / `rgba(197,242,74,.12)` | arrow icon + value (e.g. ↓ 1.5 kg on a cut), check + "ACTIVE" |
| `--warn` / `--warn-soft` | `#9C6500` / `rgba(196,132,0,.13)` | `#F2BE4A` / `rgba(242,190,74,.12)` | ↑ icon + value (weight up on a cut) |
| `--danger` / `--danger-soft` | `#D6334F` / `rgba(214,51,79,.1)` | `#FF5C7A` / `rgba(255,92,122,.12)` | unread dot (with count in the real UI), destructive actions |

Sequential (adherence heatmap): 6 steps of `--heat` (= `--accent-strong`) mixed into `--surface-2` with `color-mix(in oklab, …)` at 0% (step 0 is `--surface-3`), 18, 32, 52, 74 and 90%. Future days are empty cells with a 1px `--hairline-strong` outline. Today gets a 1.5px surface gap plus a 1.5px `--ink-1` ring.

### `.night` island (hero card, rest timer)

These values are forced in both themes: `--surface-1 #0D111A`, `--surface-2 #171D2A`, `--surface-3 #212839`, `--hairline rgba(160,180,220,.10)`, `--hairline-strong rgba(160,180,220,.18)`, `--ink-1 #F3F6FB`, `--ink-2 #A7B0C2`, `--ink-3 #727C90`, `--accent-strong #D4FF3F`, `--accent-soft rgba(212,255,63,.12)`.
Hero background: `radial-gradient(260px 200px at 100% 0, member 30%, transparent 70%)`, then `radial-gradient(200px 140px at 0 100%, rgba(212,255,63,.07), transparent 70%)`, then `linear-gradient(160deg, #141A27, #0B0F18 60%)`.

---

## 2. Typography

Both families are Google Fonts with the **Greek** subset, loaded like this:
`https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Sofia+Sans+Extra+Condensed:wght@600;700;800;900&display=swap`

- `--f-num`: **Sofia Sans Extra Condensed**, used for numerals, screen titles and the greeting. Always set `font-variant-numeric: tabular-nums lining-nums`.
- `--f-ui`: **Manrope**, used for all UI text.
- The multiplication sign in "55 × 10" is set in Manrope at .72em in `--ink-3` (`.x`), because the condensed × reads like an asterisk. The same goes for "~" in "~8–9" (`.tl`).

| Role | Family / weight | Size / line-height | Tracking | Example |
|---|---|---|---|---|
| Display XXL | Num 900 | 100 / .78 | -0.015em | body weight "80.9" |
| Display XL | Num 900 | 72 / .78, uppercase | -0.01em | hero workout "PULL" |
| Score | Num 900 | 56 / .85 | .01em | "5–2" |
| Timer | Num 900 | 42 / .85 | .005em | rest "1:47" |
| Stat | Num 800 | 40 / .9 (unit 17px, `--ink-2`) | -0.01em | tiles "92%" |
| Metric M | Num 800 | 34 / .9 | -0.01em | "80.9 kg" mini card |
| Screen title | Num 900 | 32 / .95, uppercase | .005em | "SQUAD" |
| Greeting | Num 800 | 33 / 1 | -0.005em | "Καλησπέρα, Στέλιο" |
| Input value | Num 800 | 28 / 1 | .01em | set kg/reps |
| Inline number | Num 800 | 16–24 | .01em | "124 / 180 g", tape values 18 |
| Title | Manrope 800 | 18 / 22 (card), 17 / 21 | -0.015em | exercise name |
| Section | Manrope 800 | 15 / 20 | -0.01em | "Squad pulse" |
| Body | Manrope 600 | 13–14 / 18 | 0 | coach note |
| Caption | Manrope 600–700 | 11–12 / 14–16 | 0 | meta lines |
| Eyebrow | Manrope 800 | 11 / 14, uppercase | .10em | "THU 24 SEP · WEEK 3 OF 12" |
| Micro label | Manrope 800 | 9.5 / 12, uppercase | .10–.12em | "SETS", "KG", block labels |
| Tab label | Manrope 700 | 10.5 / 12 | .01em | |

Units after big numbers ("kg", "%", "wk") use the same family at about 25–45% of the number's size, in `--ink-2`.

---

## 3. Spacing, layout, radii, elevation

- Base unit is **4**. Scale: `2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32`.
- Design frame is 390×844. Screen gutter **16**, stack gap between blocks **10**, card padding **12–16** (16 by default, 12–14 for dense cards), grid gap in 2- and 3-up rows **10**.
- Safe areas: status bar 50 and content starts at **54**. Tab bar is **84** (50 + 34 home-indicator inset). Floating sheets sit **8** above the tab bar (`bottom: 92px`, inset 10 left and right). In code use `env(safe-area-inset-*)`.
- Tap targets are ≥ **44×44**. Set inputs are **52** tall with 28px values, and the set-done button is 52×52. Stepper buttons are 44. Primary CTA is **48–52**.
- Radii: `7` (PR badge, leader pill) · `9–10` (segment inner, tick) · `12` (small button) · `14` (inputs, spec strip, chips-block, icon button) · `16` (set row highlight, primary button) · `18` (tiles) · `20` (mini cards) · `22` (cards, dock, timer) · `26` (hero, VS card) · `999` (chips, pills) · device `56`.

| Elevation | Light | Dark |
|---|---|---|
| e1 card (`--shadow-1`) | `0 1px 2px rgba(16,24,40,.05), 0 8px 22px -12px rgba(16,24,40,.16)` | `inset 0 1px 0 rgba(255,255,255,.035), 0 1px 2px rgba(0,0,0,.5)` + 1px border `--card-border` |
| e2 floating (`--shadow-2`) | `0 18px 40px -12px rgba(16,24,40,.28), 0 2px 6px rgba(16,24,40,.06)` | `0 20px 44px -12px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.06)` |
| Accent glow | `0 10px 26px -10px var(--accent-glow)` under volt fills | same |
| Member glow (dark only) | none | avatars: `0 0 18px -2px color-mix(member 55%, transparent)`. VS card: two 160×130 radial glows (blue 22% on the left, orange 18% on the right) |

Dark mode gets its depth from **surface steps plus a 1px top inner highlight**, not from drop shadows.

---

## 4. Iconography

- Custom inline SVG sprite (`<symbol>` + `<use>`), `viewBox 0 0 24 24`, **1.8px stroke**, round caps and joins, `fill: none`, `currentColor`. Sizes: 20 (default), 16 (inline meta), 12 (inside pills, stroke 2.2), 22–24 (primary actions). Filled glyphs are allowed only for play and the video triangle.
- Set: home, train (dumbbell), body (scale dial), fuel (fork + knife), squad, play, check, clock, list, flame, trophy, calendar-check, bell, chevron-down/right, plus, minus, x, video, file, open-external, arrow-up/down, history, bolt, more, swap, note, target, weight-stack (machine), timer, message, sun, moon, plus-circle.
- Icons take ink tokens (`--ink-3` for decorative, `--ink-1` or `--accent-ink` for active). They are never member-colored, and never emoji. Emoji appear only as user content (reactions).

---

## 5. Components

**Card**: `surface-1`, radius 22, padding 16, 1px `--card-border`, `--shadow-1`. Header row: section title (Manrope 800 15) on the left, link (Manrope 700 12, `--ink-2`, with a 14px chevron) on the right.

**Hero card** (`.hero.night`): radius 26, padding 14/14/14/16, night gradient plus member glow. The top row has an eyebrow with a 7px volt live dot (`box-shadow 0 0 10px`) and week dots: 23px circles with a 4 gap. Done = volt fill with `accent-ink` letter. Today = 2px volt ring. Upcoming = 1.5px `hairline-strong` ring. Title is Display XL, meta sits right-aligned (16px icons), and the primary button is full width at 48.

**Stat tile**: radius 18, padding 11/12/10. 16px icon top-right in `--ink-3`, then the Stat numeral (+ unit), then a label in Manrope 700 12 `--ink-2`. Three-up grid, gap 10.

**Buttons**
- Primary: volt fill, `accent-ink` text in Manrope 800 16, height 48–52, radius 16, accent glow, `inset 0 -2px 0 rgba(0,0,0,.08)`.
- Ghost: transparent, `inset 0 0 0 1.5px var(--hairline-strong)`, height 40, radius 12.
- Tonal: `surface-3`, `ink-1`.
- Icon: 44×44, radius 14, `surface-2`, `ink-2`. Unread dot is 8px `--danger` with a 2px ring.
- Set-done check: 52×52, radius 16. Idle is an outline. Done is a volt fill.

**Chips**: height 28 (26 in dense rows), padding 0 10, pill radius, `surface-2`, Manrope 700 12 `ink-2`, 14px icon. `.chip.acc` = `accent-soft` background, `ink-1` text, `accent-strong` icon (e.g. "Aim 57.5 kg").
**Delta pill**: height 22, Manrope 800 12, `good-soft`/`good` with a 12px arrow.
**PR badge**: height 20, radius 7, volt fill, Manrope 900 11 uppercase, trophy icon.

**Segmented control**: track `surface-2`, radius 14, padding 4, height 44 (36 for the small range tabs, 46 for day tabs with a sub-label). Items are Manrope 700 13 `ink-3`. Selected = `--seg-on`, `ink-1`, `0 1px 3px rgba(0,0,0,.12)`. Day tabs carry a 9.5px uppercase sub-label ("✓ STR", "HYP · NOW").

**Week chip** (program weeks 1–12): 44×50, radius 14, e1. Number is Num 800 21, with a 22×3 completion bar below. Done = full `accent-strong` bar. Current = volt fill with an `accent-ink` bar on `rgba(10,14,2,.18)`. Future = `ink-3` number with an empty bar. Block labels ("FOUNDATION" over 1–5, "RAMPING" from 6) are 9.5px micro labels followed by a hairline rule. The row fades out at the right edge (mask 80%→transparent) to show that it scrolls.

**Exercise card**: radius 24. Eyebrow "EXERCISE 1 OF 7", title, demo-video icon button, tags (machine, last-set technique). Spec strip: `surface-2`, radius 14, 4 cells with 1px `hairline-strong` separators, micro label above a Num 800 21 value. "Last time" row: history icon, "Week 2", then values in Num 800 16 `ink-2`, then an Aim chip. The expander is a `<details>` row 44 tall with a top hairline.

**Set row**: grid `44px 1fr 1fr 52px`, gap 8, vertical padding 4.
- Set column: Num 800 24 number, plus either a PR badge or a technique micro tag ("FAIL").
- Input: 52 tall, radius 14, `surface-2`, `inset 0 0 0 1px hairline-strong`, value Num 800 28 centered. Previous performance shows as the **placeholder** in `--ink-ph`.
- Focused: `surface-1`, `inset 0 0 0 2px accent-strong`, `0 0 0 4px accent-soft`, 2×24 caret in `accent-strong`.
- Done: the row gets an `accent-soft` band (radius 16, bleeds 8px) and the inputs lose their chrome.

**Rest timer sheet** (`.rest.night`): floats 8 above the tab bar, radius 22, padding 12/12/12/16, e2 dark. A 3px progress line at the top edge (volt with a 10px glow) drains from full. Micro label "REST · OF 2:30" in volt, Timer numeral, and a two-line "Next" caption. Controls are 48×48 tonal buttons (−15, +30) and a 44 outline close.

**Tab bar**: 5 equal items, each a 52×28 icon pill plus a label. Active = volt pill, `accent-ink` icon, `accent-glow` shadow, and an `ink-1` label. Inactive = `ink-3`. Top hairline, blur backdrop. Badge dot is 8px `--danger`.

**Avatar**: circle of 24/32/40/54, initials in Manrope 800 at ~38% of the diameter, white with `text-shadow 0 1px 1px rgba(0,0,0,.18)`. Background `linear-gradient(145deg, mix(member 88%, white), member 45%, mix(member 72%, black))`, then a 2px `surface-1` ring, then the dark-only member glow. Stacks overlap by −8px.

**Tale-of-the-tape row**: grid `76px 1fr 76px`. Outer values are Num 18. The leader's value is Num 900 `ink-1` on a `surface-3` pill (radius 7), and the trailer's is `ink-3`. The center label is Manrope 700 12 `ink-2`, with an optional 10px sub-line. Below that is a butterfly bar: two halves with a 4 gap, 6px thick, growing outward from the center and rounded 4px at the data end. Length = value / max(a, b). Leader bar is at 100% opacity and trailer at 34%. Score block: "5–2" plus a 7-segment win strip (12×5, gap 2, member colors).

**Floating dock** (quick log): same placement as the timer, `surface-1`, e2, radius 24. Label on the left, stepper (`surface-2` track, two 44 buttons, Num 900 28 value) and a 52×50 volt save button.

**Meal row**: 42 tall with a 44 hit target on the tick. Tick is 26×26, radius 9: outline when open, volt fill with `accent-ink` check when done. The "Next" row gets an `accent-soft` band plus a volt "NEXT" micro tag. Name is Manrope 800 13.5 and time is `ink-3`. kcal is Num 800 16 on the right.

**Progress ring**: track `surface-3`, value `accent-strong`, round cap, starting at 12 o'clock. Stroke is 8.5 for a 96 ring and 5.5 for a 48 ring. The center value uses the Num family.

---

## 6. Charts

- **Lines**: 2px, `stroke-linecap/linejoin: round`, monotone-cubic smoothing (no overshoot).
- **End dots**: r = 4–4.5 (8–9px), fill is the series color, with a 2px ring in `--surface-1`.
- **Area fills**: gradient from 10–14% down to 0 under a single series. For two series, only the **lead band** between the lines is filled (10%, in the leader's color).
- **Gridlines**: 1px solid `--grid`, `shape-rendering: crispEdges`. The baseline and reference markers use `--hairline-strong`.
- **Axes**: Manrope 600 10 `--ink-3`, 3–4 ticks max, no axis lines.
- **Goal / reference line**: solid 1.25px `--ink-2`, never dashed. Its tick label is `ink-1` 800, with an end label "Goal 78.0".
- **Bars**: ≤24px thick (15 used), 4px rounded **data end** only, always a zero baseline, 2px surface gap between adjacent bars.
- **Scatter points** (daily weigh-ins): r 2.6, 38% opacity of the member color.
- **Labels**: a direct value label at line ends and on the latest bar only, in Num 800 12–13 `ink-1`.
- **Legend**: present whenever there are ≥2 series (or mixed mark types). 8px dot or 14×2 line swatch, then Manrope 700 11 `ink-2`.
- Never dual axes. Identity comes from member colors, never from rank.
- Every mark gets a `<title>` tooltip, and the SVG gets `role="img"` plus an `aria-label` summary.

---

## 7. Motion (for implementation)

- Rest sheet slides up in 280ms `cubic-bezier(.2,.8,.2,1)`, and the progress line drains linearly.
- Set-done: check scales 0.9→1 in 160ms, the volt band fades in over 200ms, and the PR badge pops at 1→1.08→1.
- Tab pill cross-fades in 200ms.
- The caret blinks at 1.1s steps.
- Respect `prefers-reduced-motion`: switch to fades only.
