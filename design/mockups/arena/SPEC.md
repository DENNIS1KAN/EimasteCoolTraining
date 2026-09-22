# Arena — design system spec

**Direction:** training framed as a friendly fight between friends (Strava meets a boxing weigh-in poster, with a pinch of Duolingo delight). Stelios is the **blue corner** and Thanos the **orange corner**. Coach Dennis (aqua) is in the corner giving notes. Wins earn magenta trophies.

Files: `index.html` (5 mobile frames, light/dark switch), `shot-light.png`, `shot-dark.png`.

## 0. Principles

1. **Your corner color follows your data.** Charts, rings, meters and completion bars for the signed-in athlete use *their* member color (`--me`), so Stelios's app is tinted blue and Thanos's orange. Only data and identity marks wear member colors. Text never does.
2. **Magenta means action and wins.** Primary buttons, the Train button, selection (the current week), done ticks, PR badges and kudos all use magenta. Magenta is never used for data series.
3. **Poster type for numbers and titles.** Numbers and screen titles use a heavy condensed italic face. Everything else uses a friendly geometric sans.
4. **Color blocking at a few focal points only:** the magenta fight card (Home), the blue weigh-in (Body), the split blue/orange poster (Squad) and the ink rest bar (Train). Everything else is quiet white or graphite cards.
5. **Thumb first.** Primary actions sit in the bottom third: the center Train button, the docked quick-log bar, the set-complete button and the rest-bar controls. All tap targets are at least 44px.

---

## 1. Color tokens

Tokens are CSS custom properties on `:root`. Dark values are declared twice, under `@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){…} }` and under `:root[data-theme="dark"]{…}`. `body` always paints `var(--page)`. Inside the app shell, `var(--bg)` is the screen background.

### Surfaces & ink

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F3F1F7` | `#0F0D14` | App screen background (lavender grey / aubergine black) |
| `--card` | `#FFFFFF` | `#1A1722` | Cards, inputs, tab items |
| `--card-2` | `#F5F3F8` | `#221E2B` | Inset areas: prescription strip, active set, file row, soft buttons |
| `--card-3` | `#ECE9F2` | `#2B2636` | Segmented track, meter tracks, tags |
| `--line` | `#E6E2EC` | `rgba(255,255,255,.075)` | Hairline dividers inside cards |
| `--grid` | `#ECE9F1` | `rgba(255,255,255,.075)` | Chart gridlines (1px, solid) |
| `--grid-strong` | `#D9D4E1` | `rgba(255,255,255,.16)` | Chart baseline, "Start" marker, empty checkbox ring |
| `--ink` | `#17141E` | `#F6F3FB` | Primary text and numbers (18.2:1 / 16.1:1 on card) |
| `--ink-2` | `#575166` | `#B8B1C7` | Secondary text (7.6:1 / 8.5:1) |
| `--ink-3` | `#6E687D` | `#8A8399` | Tertiary text, captions, axis ticks (5.3:1 / 4.9:1, AA for small text) |
| `--ph` | `#B3AEBE` | `#5F5970` | Input placeholders (previous performance "ghost" values) |
| `--inv` / `--inv-ink` | `#17141E` / `#FFF` | `#F6F3FB` / `#17141E` | Inverse badges (exercise index, active set number) |
| `--block` | `#17141E` | `#26212F` | Ink color block (rest timer bar, VS medallion, selected theme button) |
| `--block-ink` / `--block-ink-2` | `#FFF` / `rgba(255,255,255,.62)` | `#F6F3FB` / `rgba(246,243,251,.6)` | Text on `--block` |
| `--tabbar` | `rgba(255,255,255,.90)` + blur 18px | `rgba(28,25,36,.90)` + blur 18px | Floating tab bar |
| `--page` | `#E4E1EA` | `#060509` | Presentation page only (outside the phones) |

### Brand accent (one color): "Arena magenta"

| Token | Light | Dark |
|---|---|---|
| `--accent` | `#D6269B` | `#CF2AA0` |
| `--accent-2` (deep) | `#A8177A` | `#9B177A` |
| `--hero` gradient | `linear-gradient(152deg,#E73BB0 0%,#D6269B 42%,#A0166F 100%)` | `linear-gradient(152deg,#DA34A6 0%,#BD2291 45%,#7A1260 100%)` |
| `--accent-text` (magenta text/icons on cards) | `#A3187A` (7.1:1) | `#F383CF` (7.5:1) |
| `--accent-tint` (badge/active-tab backgrounds) | `#FCE7F4` | `rgba(207,42,160,.18)` |
| `--accent-ring` (glows, focus halos) | `rgba(214,38,155,.30)` | `rgba(243,131,207,.40)` |

White text on `--accent` measures 4.56:1 (light) and 4.68:1 (dark). The gradient's deep end is 7.4:1.

**Validation:** I ran the dataviz validator (OKLab) with magenta as a 4th slot against the three fixed member hues. It passes both modes. Light `#D6269B`: worst normal-vision ΔE 20.6 (vs orange) and worst CVD ΔE 9.2 (deutan; that worst pair is aqua↔orange, not magenta). Dark `#CF2AA0`: normal ΔE 20.0 and CVD ΔE 8.3. Violet and pink candidates failed against blue or orange, and the volt/lime family collided with aqua and with the other directions.

### Member identity (fixed, never re-hued)

| Member | Token | Light | Dark | Deep stop (avatars/gradients only) L / D |
|---|---|---|---|---|
| Stelios | `--m-s` | `#2a78d6` | `#3987e5` | `#1b5cb0` / `#2464b6` |
| Thanos | `--m-t` | `#eb6834` | `#d95926` | `#c44b1b` / `#a93d12` |
| Dennis | `--m-d` | `#1baf7a` | `#199e70` | `#0c8558` / `#0c7450` |

`--me` is set to the signed-in member's `--m-*`.

Rules:
- **Avatars:** `linear-gradient(140deg, --m-x 10%, --m-x-2 100%)` with white initials, weight 800.
- **Series, lines, bars, rings and heatmap cells** use `--m-x`.
- **Labels, values and legends stay in ink.** A colored dot or bar beside the text carries identity.
- **Color-blocked text zones:** white text on a member block always sits on the deep end of the gradient. Poster halves use `20deg` / `-20deg` with the deep stop at the top where the names are, and the weigh-in card uses `160deg`.

### Status (distinct from member hues, always icon + label)

| Token | Light | Dark | Icon | Where |
|---|---|---|---|---|
| `--good` / `--good-tint` | `#3C7F1A` / `#E7F1DF` | `#86C440` / `rgba(134,196,64,.14)` | check, arrow-down (weight loss when cutting) | "On pace", "Active", weight deltas |
| `--warn` / `--warn-tint` | `#D69F00` / `#FBF1D4` | `#F5C518` / `rgba(245,197,24,.13)` | arrow-up, alert | Weight up vs yesterday, missed-meal nudges |
| `--danger` / `--danger-tint` | `#C81E3A` / `#FBE3E7` | `#FF5A6E` / `rgba(255,90,110,.14)` | flame, record dot | "Last set · to failure", live-session dot, PDF file badge |

Status colors only tint a chip background or color an icon. The text inside stays `--ink`.

Measured normal-vision ΔE against the member hues: good vs aqua is 15.0 (light) and 16.1 (dark), and danger vs orange is 15.1 (light) and 10.6 (dark). The dark danger/orange pair is the only one below 15, so status is never shown by color alone: every status carries an icon and a word. Status colors never appear in charts.

---

## 2. Typography

Google Fonts, both families with Greek subsets:

```html
<link href="https://fonts.googleapis.com/css2?family=Fira+Sans+Extra+Condensed:ital,wght@0,600;0,700;0,800;0,900;1,700;1,800;1,900&family=Geologica:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

- **Display / numerals: Fira Sans Extra Condensed.** Used for every number the athlete cares about (weights, reps, scores, streaks, percentages), screen titles and the day title. Poster weights are 900 italic; data numerals are 800 upright. Use proportional figures for hero numbers and `tabular-nums` only for ticking clocks and aligned columns.
- **UI text: Geologica.** Friendly geometric sans with round shapes and clear Greek. Weights 400 to 800.
- Greek: set `lang="el"` on Greek content. `text-transform:uppercase` then drops tonos correctly (ΠΡΟΠΟΝΗΣΗ, not ΠΡΟΠΌΝΗΣΗ). Budget about 15% more line length for Greek labels, and never truncate titles in the fight card (let them scale down a step instead).

| Role | Family | Size / line-height | Weight | Extras |
|---|---|---|---|---|
| Weigh-in hero number | Fira XC | 80 / 0.9 | 900 italic | unit 26px 800 italic, opacity .85 |
| Poster score | Fira XC | 70 / 1 | 900 italic | text-shadow `0 6px 18px rgba(0,0,0,.18)` |
| Fight-card title | Fira XC | 58 / 0.86 | 900 italic, uppercase | |
| Rest timer | Fira XC | 36 / 0.9 | 900 italic | tabular |
| Screen title (`.h-title`) | Fira XC | 36 / 0.95 | 900 italic, uppercase | |
| Stat value | Fira XC | 34 / 0.9 | 800 | unit `<small>` 16px, `--ink-2` |
| Set input value | Fira XC | 30 / 1 | 800 | |
| Card figure | Fira XC | 28 / 1 | 800 | |
| Set value / list figure | Fira XC | 20–24 / 1 | 800 | |
| Prescription value | Fira XC | 19 / 1.1 | 800 | secondary part (`/ 10`) 15px `--ink-3` |
| Greeting | Geologica | 22 / 1.15 | 800, -0.025em | |
| Plan title | Geologica | 18 / 1.15 | 800, -0.02em | |
| Card / exercise title | Geologica | 15–16 / 1.25 | 700, -0.015em | |
| Body | Geologica | 13.5–15 / 1.38–1.4 | 400–500 | |
| Button | Geologica | 15 (sm 13) | 700 | |
| Label / meta | Geologica | 12–13 / 1.3 | 500–600 | |
| Overline (`.over`) | Geologica | 10.5 / 1.2 | 700, uppercase, +0.10em | `--ink-3` |
| Tab label | Geologica | 10.5 | 600 | |
| Chart tick | Geologica | 10 | 500 | `--ink-3` |
| Chart end label | Fira XC | 15 (sm 12) | 800 | `--ink` |

---

## 3. Spacing

The base unit is 4px, with 2px and 6px half-steps for dense data rows.

| Token | px | Typical use |
|---|---|---|
| `--s-0.5` | 2 | Gap between number and unit |
| `--s-1` | 4 | Icon to label inside chips; segmented padding (3) |
| `--s-1.5` | 6 | Tag gaps; week-chip gap |
| `--s-2` | 8 | Inline groups; legend gaps |
| `--s-2.5` | 10 | **Gap between cards on a screen**; tile gap |
| `--s-3` | 12 | Card header to content; hero internal gaps |
| `--s-3.5` | 14 | Card padding (dense cards: exercise, meals, plan) |
| `--s-4` | 16 | **Screen gutter** (left/right); card padding (default) |
| `--s-5` | 20 | Tab bar offset from bottom edge (sits on the safe area) |
| `--s-6` | 24 | Floating rest-bar offset from bottom |

Screen frame is 390×844. The status bar and safe top take 56px. Content scrolls under a floating tab bar whose top edge is at 762px. Scroll padding at the bottom is 110px, and a 100px bottom fade (`transparent` to `--bg` at 72%) sits behind the bar. Row heights: list rows 45–48px, tale-of-tape rows 31px, set rows 60px (inputs).

## 4. Radii

| Token | px | Use |
|---|---|---|
| `--r-xs` | 4–6 | Chart bar data-end (4), heat cells (3.5), tiny tags (6) |
| `--r-sm` | 8 | PR badge, status chip, PDF glyph |
| `--r-md` | 10 | Chips, checkboxes, stat icon tiles, exercise index |
| `--r-lg` | 12–14 | Segmented control (outer 14, inner 11), small buttons (12), icon buttons (14) |
| `--r-xl` | 15–16 | Inputs (15), buttons (16), quick-log stepper |
| `--r-2xl` | 20–22 | Stat tiles (20), cards (22), Train button (22, a squircle-ish square) |
| `--r-3xl` | 24–26 | Color-blocked hero cards (26), tab bar (26), floating bars (24–26) |
| device | 54 | Phone frame only |

## 5. Elevation

| Level | Light | Dark |
|---|---|---|
| 0: flat (inset areas) | none, fill `--card-2`/`--card-3` | same |
| 1: card (`--card-sh`) | `0 1px 2px rgba(30,20,45,.05), 0 10px 26px -16px rgba(30,20,45,.20)` | `inset 0 1px 0 rgba(255,255,255,.035), 0 0 0 1px rgba(255,255,255,.055)` (hairline edge, no drop) |
| 2: floating (`--float-sh`) for tab bar, quick-log dock | `0 2px 6px rgba(30,20,45,.06), 0 22px 44px -18px rgba(30,20,45,.38)` | `0 0 0 1px rgba(255,255,255,.08), 0 24px 48px -16px rgba(0,0,0,.8)` |
| 3: color block glow | hero `0 18px 34px -20px rgba(160,20,110,.8)`; weigh-in `0 18px 34px -22px rgba(20,60,140,.9)`; accent buttons `0 10px 20px -10px var(--accent-ring)` | same |

In dark mode, surfaces separate by lightness steps (`bg` < `card` < `card-2` < `card-3`) plus the hairline edge, not by shadow.

## 6. Iconography

- **Grid:** 24×24 with 2px stroke, `round` caps and joins, no fills. Exceptions are `play` (filled) and the status-bar glyphs.
- **Sizes:** 24 (tab bar), 20 (icon buttons), 18 (in buttons/tiles), 16/14 (in chips and badges). Stroke stays 2 (2.6–3.2 for check marks at 14–17px).
- **Delivery:** one inline `<svg><symbol>` sprite, used via `<use href="#i-name">`. Color is always `currentColor`.
- **Set:** home, dumbbell (Train), scale (Body), bowl (Fuel), squad, bell, play, check, chevrons, flame (streak and "to failure"), trophy (PR), crown (leader), clock, history, swap, download, plus, minus, x, arrow up/down, trend-down, target, calendar, bolt (myo-reps, brand mark), hand (kudos), sparkle, sun, moon.
- No emoji as UI. Emoji appear only as user reactions (🔥 💪).

---

## 7. Components

### Card
`background:--card; border-radius:22px; padding:16px (dense 12–14); box-shadow:--card-sh`. Header row: title 15/700 left, meta or link right, 12px below.

### Fight card (Home hero)
- **Container:** `--hero` gradient, radius 26, padding 15/15/15/17, white text.
- **Texture:** a -58° stripe overlay (2px lines every 14px at 7% white), masked in from the right.
- **Ghost numeral:** the program week number at 170px, 900 italic, 10% white, bleeding off the top right.
- **Content:** overline (white 82%), title 58px, meta line with 3px dot separators.
- **Week dots:** 26px circles. Done = white fill with a magenta check. Today = white 2px ring with an 8px center dot and a 3px halo. Upcoming = 35% white ring. Labels 9.5/700 below.
- **Start button:** `.btn-white` (48h, radius 16, ink text, play icon).

### Stat tile
Tiles sit in a 3-column grid with a 10px gap, radius 20, padding 11/11/10/12. Top row: value (34px Fira 800, unit 16px `--ink-2`) with a 28px icon tile at the right. The icon tile uses `--accent-tint` with an `--accent-text` glyph for achievements, or a 28px progress ring (stroke 4.5, `--me`). Label 11.5/600 `--ink-2`.

### Buttons
| Variant | Spec |
|---|---|
| Primary | `--hero` gradient, white 15/700, h48, radius 16, glow `0 10px 20px -10px --accent-ring` |
| On-color (white) | `#FFF` bg, `#17141E` text, used only on the hero block |
| Soft | `--card-2` bg, ink text |
| Raised small | `--card` + `--card-sh`, h36, radius 12, 13/700 (e.g. Finish, date nav) |
| Icon | 44×44, radius 14, `--card` + `--card-sh` (or `--card-2` soft) |
| Complete-set | 60×60, radius 16, `--hero`, white 28px check (stroke 2.6) |

### Chips, tags, segmented control
- **Chip:** h28, radius 10, `--card-2`, 12/600 `--ink-2`, 14px icon, 5px gap. Status chips use the `*-tint` bg with an ink label and a status-colored icon.
- **Tag:** h22, radius 7, 11/600. A `.machine` tag uses `--card-3` with ink text and a dumbbell icon.
- **Segmented:** track `--card-3`, radius 14, padding 3. Items are 38px tall (34 in cards), radius 11, 13/600 `--ink-2`. The selected item uses `--seg-on` (`#FFF` / `#302A3B`) with `--seg-on-sh`, ink 700. A done state adds a 15px `--me` check disc, and today adds a 6px magenta dot.
- **Week chip:** 46×54, radius 15, `--card`. It shows the number (21px Fira 800) and a 22×4 completion bar (`--me` on `--card-3`). The current week uses `--hero` with a white number and a white bar on 28% white. Future weeks use `--ink-3` numbers. Block labels ("Foundation", "Ramping") are 9.5px/800 overlines with a hairline rule, and there is an 8px extra gap at the block boundary.

### Exercise card and set rows
- **Head:** a 30px `--inv` index badge, the name at 16/700, tags, and a 44px video button.
- **Prescription strip:** a 4-column grid on `--card-2`, radius 14, with 1px `--line` dividers. Each column has a label (9.5px/700 uppercase) and a value (19px Fira 800).
- **Previous performance:** history icon, "Last time · Week 2" in 12px `--ink-3`, then the values in 15px Fira 700 `--ink-2`.
- **Done set:** a 28px `--me` number disc and the value `57.5 kg × 10` at 24px (unit 13px `--ink-3`). Below it, a 11px e1RM line with the delta against the best. A PR badge and a 44px tinted check (`--accent-tint`, `--accent-text`) sit on the right.
- **Active set:** container `--card-2`, radius 18, padding 10, inset ring `1.5px --line`.
  - Header: an `--inv` number disc, a technique flag, and the target reps on the right.
  - Technique flag: "Last set · to failure" in a `--danger-tint` chip with a flame icon.
  - Inputs: two 60px-tall fields (`--card`, radius 15, value 30px Fira 800, unit label 11px uppercase on the right).
  - Weight is prefilled from the previous set. Reps show last time's value in `--ph`.
  - Focus state: `inset 0 0 0 2px --accent, 0 0 0 4px --accent-tint` with a 2px magenta caret.
  - Then the 60px complete-set button.
- **Expander ("Warm-up, swaps & notes"):** 46px row with a top hairline, swap icon, 13.5/700 title, meta "2 swaps" and a chevron. When open it lists warm-up sets, the two substitutions (tap to swap in) and the coach's note, plus a "Watch demo" row.
- **Collapsed next exercise:** 30px `--card-3` index, name, and a one-line prescription with an inline technique tag (h20, radius 6, bolt icon).

### PR badge
h22, radius 8, `--hero` gradient, white 11/800 +0.04em "PR" with a 13px trophy. Glow `0 4px 10px -4px --accent-ring`. On first appearance, animate a 180ms scale-in (0.6 to 1, overshoot) with a 4-spark burst.

### Rest timer bar
- Floats 12px from the sides and 24px from the bottom, and covers the tab bar while resting. It slides up over 240ms (`cubic-bezier(.2,.9,.3,1.2)`).
- **Container:** `--block`, radius 26, padding 10.
- **Content:**
  - A 52px ring: 4.5px stroke, `#F383CF` on 12% white, counting down.
  - The time in 36px Fira 900 italic, tabular.
  - Meta at 11.5px: "Rest 2–3′ · next **Set 2**".
  - Controls: 48px `−15` / `+30` (15px radius, 8% white fill) and a 44px outlined close.
- **Haptics:** haptic tick at 0:10 and a double tick at 0:00.

### Tab bar
- **Bar:** floating, left/right 14px, bottom 20px, h62, radius 26, `--tabbar` + blur, `--float-sh`. Five equal columns.
- **Order:** Home · Body · **Train** · Fuel · Squad. Train is centered for thumb reach.
- **Items:** a 44×30 icon pill with a 10.5px label.
  - Inactive: `--ink-3`.
  - Active: label `--ink`, pill `--accent-tint`, icon `--accent-text`.
- **Train button:** a 60×60 radius-22 `--hero` square raised 30px above the bar. It has a 5px `--bg` ring that reads as a notch, and a white 28px dumbbell. On the Train tab it gains an extra 3px `--accent-ring`.

### Avatar
- Circle with the member gradient and white initials 800. Sizes: 22 (stacks, overlap -6px, 2px `--card` ring), 32, 40, 48.
- On Home, the user's avatar sits inside a 48px progress ring (3px, `--me` on `--card-3`) showing the week's workouts (2/5).
- On posters, avatars get a `2.5px` white ring.

### Poster (Squad, head-to-head)
- **Layout:** a 134px band split diagonally. Each half is 56% wide and clipped (`polygon(0 0,100% 0,84% 100%,0 100%)` and its mirror), which leaves a card-colored gap at the seam. Each half uses its member gradient, deep stop at the top, with the 12px stripe texture.
- **Content:** "Blue corner" / "Orange corner" overlines, avatar and name, and the score in 70px Fira 900 italic.
- **VS medallion:** 50px `--block` disc with a 4px `--card` ring, "VS" in 21px 900 italic.
- **Verdict row:** 30px crown tile in `--accent-tint`, "Stelios leads the tape 5–2", and a period picker.

### Tale-of-the-tape row
- **Grid:** `50px 1fr 88px 1fr 50px`, row height 31px, hairline between rows. Left value, left bar (grows leftwards from the center), center label (11/600 `--ink-2`), right bar, right value.
- **Bars:** 8px tall, rounded 4px at the data end and 1px at the center baseline. Length is proportional to the row maximum.
- **Leader:** solid member color, value in `--ink` 800, and a 4px triangle marker pointing at the bar.
- **Trailing side:** a ghost bar (transparent with `inset 0 0 0 1.5px` member color), value in `--ink-3` 700.

### Quick-log dock (Body)
- **Container:** floating card at left/right 14 and bottom 94 (it sits on top of the tab bar), radius 24, `--float-sh`.
- **Content:** "Log today" with the date, then a stepper: a `--card-2` track holding two 44px raised `−`/`+` buttons (±0.1 kg, long-press repeats) and the value at 26px Fira 800. A 52px `--hero` save button with a check sits at the end.

### Sheets (for the expander, swaps and video)
`--card`, top radius 30, 38×5 grabber (`--grid-strong`), 16px gutter, 34px bottom safe area. Scrim `rgba(10,5,20,.45)` (dark `.6`). Enter in 280ms with a spring.

### Meal row and checklist
- **Row:** min-height 45 (the whole row is the tap target), 30px checkbox (radius 10, `inset 0 0 0 2px --grid-strong`).
- **Checked:** `--hero` fill with a white check, and the name drops to `--ink-2`. No strikethrough.
- **Content:** time and kcal right-aligned (16px Fira 700 / 11px). The next meal gets a "Next" `--accent-tint` tag.

### File (PDF) row
`--card-2`, radius 16. A 34×40 page glyph (folded corner, red "PDF" label), the file name 13/700 with ellipsis, meta 11.5px, and a 44px icon button.

---

## 8. Charts

All charts are inline SVG at their real pixel size (no scaling), so 2px stays 2px. They follow the dataviz mark specs:

| Element | Spec |
|---|---|
| Line | 2px, `stroke-linecap/join: round`, monotone-X smoothing for trends, linear for cumulative counts |
| End dot | r = 4.5–5 (9–10px), member fill, **2px `--card` ring** (`stroke: var(--card)`) |
| Raw points (daily weigh-ins) | r 2.6, member fill at 38%. These are de-emphasized context, not markers |
| Area | Member color at **11% opacity**, only on single-series charts (weight trend, sparkline). Overlapping two-series areas are omitted |
| Bars | ≤ 24px (14px used), **4px rounded data-end**, square at the baseline, 2px surface gap between paired bars |
| Gridlines | 1px **solid** `--grid`, baseline `--grid-strong`, `shape-rendering: crispEdges` |
| Reference line (goal) | 1px **solid** `--ink-2` with an end label "Goal 78.0" (10/700). No dashes |
| Event marker ("Start") | 1px `--grid-strong` vertical with a tick label |
| Ticks | 10px Geologica 500 `--ink-3`, clean round values (0/5/10, 80/82) |
| Labels | Selective: end values only (13, 11, 80.9, W3 bars 89/101), in ink, never in series color |
| Legend | Always present with 2+ series. Colored dot (8–10px) or line key (14×3) beside ink text, 10.5–11.5px/600, placed above the plot |
| Axes | One y-axis only, never dual |
| Interaction (app) | Press-and-hold crosshair with a tooltip card (`--block`, ink text, radius 12). Bars and heat cells get per-mark tooltips with a hit target ≥ 24px |

- **Sparkline** (Home weight): 158×38, single series, no legend or axes, end dot only.
- **Progress ring:** track `--card-3` and arc `--me`, round cap, starting at 12 o'clock. Stroke is 4.5px at 28px, 9px at 88px (kcal) and 3px around the avatar.
- **Meters** (macros, goal track): 7–10px track `--card-3` with an `--me` fill, radius half-height. On a color block the track is 20% white with a white fill and a 20px knob with a 4px 30% halo.
- **Heatmap:** a single-hue sequential ramp built from `--m-s` at opacity 0.22 / 0.40 / 0.62 / 0.82 / 1.0 for 1–5 meals ticked. `--card-3` means none, and a hairline outline marks a future day. Today gets a 3px ink ring with a 1.5px surface gap. Cells are 11px tall, radius 3.5, with a 3–4px gap, and have day and week labels.

## 9. Motion & delight (spec for build)
- **Set complete:** the check button squashes to 0.92, the row flashes `--accent-tint` for 200ms, and the rest bar rises.
- **PR:** badge burst plus confetti in magenta with the member color (16 particles, 700ms), and a push to the squad ("Stelios hit a PR").
- **Kudos:** the pill pops to 1.15 and the count ticks up.
- **Week complete:** week chip bar fills to 100% with a small crown on the chip.
- **Respect `prefers-reduced-motion`:** replace motion with opacity fades.

## 10. Usability additions in this direction (improvised)
1. **Center Train button** in the tab bar (thumb zone, the most frequent action). The tab order becomes Home · Body · Train · Fuel · Squad.
2. **Corner-color theming** (`--me`): every personal chart and meter uses the user's member color, so the rival's data is instantly recognizable in shared views.
3. **Smart prefill:** the next set's weight copies the last set, and reps show last time as a placeholder. The active set shows "Target 8–10" so RPE/rep targets are never off-screen.
4. **e1RM and delta under each done set** explains why a PR badge appeared.
5. **Floating rest bar** replaces the tab bar while resting (−15 / +30 / skip, 48px targets), so the next exercise stays visible above it.
6. **Docked quick-log** on Body (stepper ±0.1 kg) sits right above the tab bar: one tap to log the morning weight.
7. **Plan card groups** the coach, the plan version, adherence and the PDF, so "follow the plan" and "how well I follow it" live together. The next meal is tagged "Next".
8. **Ghost bars** for the trailing side in the tale of the tape: who leads each row is readable without color-matching.
9. **Weekly progress ring around the avatar** on Home (2/5), so the week's goal is visible before any scrolling.
