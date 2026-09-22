# Logbook Pro: design system spec

The owner's paper-and-ink logbook, grown into a sports-magazine training journal. Paper background, white cards, ink type, condensed display numerals, ruled tables and hairline structure. **One loud colour, Volt**, is reserved for "go" moments: Start workout, PR badges and the rest timer. Member hues only ever mark identity.

Reference implementation: `index.html` (tokens on `:root`, all values below are copied from it).

---

## 1. Colour tokens

All colours are CSS custom properties on `:root`. Dark values are declared twice: under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` and under `:root[data-theme="dark"] {…}`. `body` always sets `background: var(--page)` (app shell: `var(--paper)`).

### Surfaces and ink

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#EBEDE9` | `#0C0F13` | App background (the "page" of the logbook) |
| `--paper-2` | `#E1E4DE` | `#161A21` | Recessed tracks on paper (segmented control track) |
| `--card` | `#FFFFFF` | `#151A21` | Cards, tab bar base, chart surface |
| `--card-2` | `#F3F4F1` | `#1C222B` | Insets inside cards: inputs, active set row, chips |
| `--card-3` | `#E9ECE6` | `#242B35` | Pressed / hover inset |
| `--seg-on` | `#FFFFFF` | `#2A313C` | Selected segment (must contrast with `--paper-2`) |
| `--card-border` | `rgba(24,32,46,.05)` | `rgba(255,255,255,.045)` | 1px card edge (dark relies on it, since there are no shadows) |
| `--ink` | `#18202E` | `#EDEFE8` | Primary text, meters, "ink" fills (Finish, Save, done checks) |
| `--ink-2` | `#465061` | `#B2B8C2` | Secondary text (8.1:1 / 8.8:1 on card) |
| `--ink-3` | `#5F6778` | `#878E9A` | Muted text, eyebrows, axis labels (≥4.5:1 on card) |
| `--ink-4` | `#8A919C` | `#646C79` | Placeholders ("previous" values), decorative indices (~3:1) |
| `--rule` | `#E5E8E2` | `#232932` | Hairlines inside cards |
| `--rule-2` | `#D2D7CF` | `#2D343F` | Hairlines on paper, input outlines, tracks on paper |
| `--grid` | `#ECEEE9` | `#1F252D` | Chart gridlines |
| `--track` | `#E8EBE5` | `#262D37` | Meter tracks inside cards |
| `--meter` | `= --ink` | `= --ink` | Progress fills (kcal ring, macros, meal blocks, week bars) |
| `--hero` / `--hero-2` | `#18202E` / `#212A3A` | `#1A202A` / `#222A36` | "Today" hero block (ink cover in light, raised slate in dark) |
| `--hero-ink` / `--hero-ink-2` / `--hero-rule` | `#F3F5EE` / `#A7AFBC` / `#323C4E` | `#EDEFE8` / `#9AA2AF` / `#2E3643` | Text and rules on the hero |

### Brand accent: Signal Volt (the only accent)

| Token | Light | Dark |
|---|---|---|
| `--accent` | `#D4F53C` | `#CDEE3A` |
| `--accent-press` | `#C4E82B` | `#BDE02A` |
| `--accent-edge` | `#B3D421` | `#CDEE3A` |
| `--on-accent` | `#141A0C` | `#10140A` |
| `--accent-wash` | `rgba(212,245,60,.38)` | `rgba(205,238,58,.16)` |

Rules: Volt is **always a fill with ink on it** (13–14:1). It is never text on paper and never a thin mark on white. It appears only on the Start CTA, PR badges, the PR-row highlighter wash, the rest timer, the current-week bar and the notification dot. Checked with the dataviz validator: Volt vs every member hue gives CVD ΔE ≥ 9 and normal-vision ΔE ≥ 24. It sits far outside the member lightness band, so it cannot be read as a fourth member.

The owner's logbook used blue + red. Blue is now Stelios's identity and red is demoted to the `danger` status, so neither can be the accent.

### Members (fixed, identity only)

| Token | Light | Dark | Member |
|---|---|---|---|
| `--m-s` | `#2a78d6` | `#3987e5` | Stelios (blue) |
| `--m-t` | `#eb6834` | `#d95926` | Thanos (orange) |
| `--m-d` | `#1baf7a` | `#199e70` | Dennis, coach (aqua) |
| `--on-member` | `#0F141C` | `#0B0F14` | Initials on member discs |

Text never wears a member colour. A dot, bar, line or avatar disc beside the text carries identity. A person's own data (weight trend, adherence heatmap, goal bar) is drawn in **their** hue: on Stelios's phone that is blue.

### Status (always icon + label, never colour alone)

| Token | Light | Dark | Tint (`-bg`) light / dark |
|---|---|---|---|
| `--good` | `#2f7d1e` | `#78c850` | `#E6F0E1` / `rgba(120,200,80,.13)` |
| `--warn` | `#7d6a00` | `#e6b54a` | `#F1EDD7` / `rgba(230,181,74,.13)` |
| `--danger` | `#c0223f` | `#ff6b9e` | `#F7E2E6` / `rgba(255,107,158,.13)` |

Status pill: tint background, **ink text**, status colour only on the icon (e.g. `↓ 1.5`). Each status hue clears normal-vision ΔE ≥ 15 against every member hue.

### Sequential (adherence heatmap: the member's own hue)

`--q0…--q5`. Light: `#EEF0EC #DCE7F6 #C0D5F1 #8DB4EA #5594E0 #2a78d6`. Dark: `#1B2028 #1B2D45 #1F3D63 #255490 #2E6DBE #3987e5`. Future days show only a 1px `--rule-2` outline. Today gets a 1.5px card gap plus a 1.5px ink ring.

### Presentation shell only
`--page` `#D9DCD5` / `#050608`, `--bezel` `#11151B` / `#1B2027`.

---

## 2. Typography

Google Fonts, all with a Greek subset:
`Sofia Sans` (400–800), `Sofia Sans Condensed` (500–800), `Sofia Sans Extra Condensed` (700–900), `Literata` italic (400/500, coach quotes only).

```
--f-body: "Sofia Sans", system-ui, sans-serif;
--f-cond: "Sofia Sans Condensed", "Sofia Sans", system-ui, sans-serif;
--f-disp: "Sofia Sans Extra Condensed", "Sofia Sans Condensed", system-ui, sans-serif;
--f-quote: "Literata", Georgia, serif;
```

| Role | Family / weight | Size / line-height | Tracking | Notes |
|---|---|---|---|---|
| Hero numeral (body weight) | disp 900 | 88px / .78 | -.02em | Unit in cond 800 22px `--ink-3` |
| Workout title (`PULL`) | disp 900 | 64px / .80 | -.01em | Uppercase |
| Score (`5–2`) | disp 900 | 64px / .80 | -.01em | Dash in `--ink-4`, 40px |
| Rest timer | disp 900 | 52px / .86 | -.01em | `tabular-nums` |
| Screen title | disp 800 | 36px / .92 | 0 | Title case |
| Greeting | disp 800 | 34px / .95 | 0 | |
| Stat value | disp 800 | 32px / .90 | -.01em | Unit cond 700 13–14px `--ink-3`, lowercase (`kg`, `wk`, `%`) |
| Card title | disp 800 | 26px / .95 | .005em | |
| Exercise name | cond 800 | 22px / 1 | -.005em | |
| Set input value | cond 800 | 24px / 1 | .005em | `tabular-nums` |
| Table value | cond 700–800 | 16–19px / 1 | .01em | Leader = 800 `--ink`, trailer = 700 `--ink-3` |
| Body | body 500 | 14–15px / 1.3 | 0 | |
| Meta / small | body 500–600 | 11.5–12.5px / 1.2 | 0 | |
| Eyebrow | cond 700 | 11px / 1.1 | .10em | Uppercase, `--ink-3` |
| Section title | cond 800 | 12px / 1 | .12em | Uppercase, `--ink`, followed by a hairline rule |
| Micro label (table heads) | cond 700 | 10px / 1 | .10em | Uppercase |
| Tab label | cond 700 | 11px / 1 | .03em | |
| Coach quote | Literata italic 400 | 15px / 1.30 | -.005em | Left 2px ink rule |

Rules:
- Big standalone numbers use proportional figures. Columns, inputs, timers and axes use `font-variant-numeric: tabular-nums`.
- Greek: when text is uppercased via CSS, set `lang="el"` on the element or root, so the browser drops the tonos (ΕΒΔΟΜΑΔΑ, not ΕΒΔΟΜΆΔΑ). The EN/EL switch in the mockup does this.
- Numbers are the loudest thing on every screen. Labels sit in condensed small caps beneath them.

---

## 3. Spacing, radii, elevation

**Spacing scale (px):** 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 32.
- Screen gutter 16 (safe-area aware: `padding: max(16px, env(safe-area-inset-left))`).
- Card padding 16 (compact cards 12–14 vertical).
- Vertical rhythm between cards 10. Section header: 12 above, 7–8 below.
- Content top = status bar 54. Content bottom padding ≥ tab bar (83) + 27.

**Radii:** phone 54 · hero 24 · timer sheet 24 · card 20 · large button 16 · stepper/timer buttons 15–16 · button 14 · segmented track 14 / segment 11 · input 12 · small button 12 · tag 8 · meal checkbox 7 · PR badge 6 · bars 3 · heatmap cell 3.5 · avatars and chips 50%.

**Elevation**
| Token | Light | Dark |
|---|---|---|
| `--shadow-1` (cards) | `0 1px 1px rgba(24,32,46,.03), 0 2px 8px -3px rgba(24,32,46,.10)` | none (1px `--card-border`) |
| `--shadow-2` (hero) | `0 2px 4px rgba(24,32,46,.06), 0 18px 36px -16px rgba(24,32,46,.34)` | `0 18px 40px -18px rgba(0,0,0,.8)` |
| `--shadow-timer` | `0 -1px 0 rgba(24,32,46,.06), 0 18px 40px -12px rgba(24,32,46,.45)` | `0 18px 50px -10px rgba(0,0,0,.85), 0 0 0 1px rgba(205,238,58,.25)` |

Tab bar: `rgba(255,255,255,.86)` / `rgba(21,26,33,.84)`, `backdrop-filter: blur(18px) saturate(1.5)`, 1px top `--rule`.

---

## 4. Iconography

- Custom inline SVG sprite on a 24×24 grid. `stroke: currentColor`, `stroke-width: 1.75`, round caps and joins, `fill: none`.
- Filled exceptions: the play triangle and the target's centre dot.
- Sizes: 24 (tab bar), 20 (default), 16 (buttons, section links), 14 / 12 (inside tags and badges; raise the stroke to 2.0–2.8 so optical weight holds).
- Set: home, train (dumbbell), body (scale), fuel (fork + knife), squad, bell, check, play, flame, trophy, calendar-check, arrow up/down, chevron right/down, plus, minus, x, file, download, history, swap, target, timer, sliders, weight-stack (machine), bolt, thumb (kudos), sun, moon.
- Emoji appear **only** inside user content (kudos reactions 🔥 💪 👏), never as UI icons.

---

## 5. Components

**Card:** `--card`, radius 20, `--shadow-1`, 1px `--card-border`, padding 16.

**Hero ("Today"):** `--hero` fill, radius 24, padding 15/14/14/16, `--shadow-2`, a faint Volt radial wash at the top-right (35% of `--accent-wash`). Content:
- eyebrow (`--hero-ink-2`)
- 64px uppercase title, with meta stats on the right (disp 800 26px over a cond 11px label, split by `--hero-rule` hairlines)
- 5-segment week strip: 5px bars; done = Volt, today = half Volt, upcoming = `--hero-rule`; labels cond 11px with ✓ on done days
- full-width Accent button

**Stat ledger (stat tiles as a ruled strip):** one card with a 3-column grid and 1px `--rule` column dividers. Each cell: value (disp 800 32px) + unit, then an icon + eyebrow label. Single stat tile: eyebrow + chevron, value, optional status pill, optional 34px sparkline.

**Buttons** (min hit 44px):
- Accent (Volt fill, `--on-accent`, `inset 0 -2px 0 rgba(0,0,0,.08)`): "go" actions only. Large is 52px / r16 with a 38px ink "go" square holding the play icon.
- Ink (`--ink` fill, `--paper` text): commit actions (Finish, Save).
- Soft (`--card-2` fill + 1px `--rule` inset): secondary.
- Ghost (text `--ink-2`).
- Sizes: 52 / 44 / 36 (a 36px visual still gets a 44px hit area through padding or margin).

**Tags / chips:** 24px, r8, cond 700 11px uppercase .035em.
- Default: `--card-2` fill + `--rule` inset.
- Ink tag: `--ink` fill, `--paper` text (e.g. "LAST SET · FAILURE", "NEXT").
- PR badge: Volt fill, 1px `--accent-edge` inset, trophy icon, cond 900 11px .08em.
- Status pill: tint fill, ink text, coloured icon.

**Segmented control:** track `--paper-2`, r14, 3px padding, 1px ink-5% inset. Segments 38px, r11, cond 700 14px `--ink-3`. Selected: `--seg-on` fill, `--ink` text, a small shadow. Completed days show a 13px check. Small variant: 30px / r8 (range tabs 1M · 3M · All).

**Week chip (program selector):** 40×48, r12, number cond 800 18px, 20×3px completion bar underneath.
- Done: card + `--meter` bar.
- Current: `--ink` fill, `--paper` number, Volt bar.
- Future: transparent with a `--rule-2` outline.
- Divider (1px `--rule-2`) between block 1 (Foundation 1–5) and block 2 (Ramping 6–12). Block labels as eyebrows above. The row scrolls horizontally with a right fade mask.

**Prescription strip:** 4-column table between a 1px `--ink` top rule and a `--rule` bottom rule. Micro label over a cond 800 19px value. Columns: Sets · Reps · RPE (`~8–9 / 10`) · Rest (`2–3′`).

**Set row:** grid `34px | 1fr | 82px | 64px | 52px`, min-height 58.
- Columns: set number (cond 800 18px) with an optional `PR` or `FAIL` badge below; previous value in `--ink-4`; kg and reps inputs (52px tall, r12, `--card-2`, cond 800 24px); check button 52×52, r14.
- States:
  - idle: check has a 2px `--rule-2` ring
  - active: row `--card-2`, inputs `--card`; the focused input gets a 2px `--ink` inset plus a 4px ink-8% halo and a 2px caret
  - done: inputs lose their chrome; check = `--ink` fill with a `--paper` tick
  - PR: row gets a left-to-right `--accent-wash` highlighter gradient
- Under the active row, a target hint: target icon + "Beat 55 × 9, aim for **57.5 × 9+**".
- Expander row (48px, top `--rule`): "Warm-up, swaps & notes" + summary + chevron.

**Rest timer sheet (the one loud element):** floats 8px above the tab bar, inset 10px, r24, Volt fill, `--shadow-timer`.
- 4px progress bar along the top edge (`--on-accent` over 10% black).
- Timer icon + eyebrow ("Rest · next: set 2").
- 52px disp 900 time + "/ 2:30".
- Controls: `−15`, `+30` (52×52, r16, 9% black fill) and close (`--on-accent` fill, Volt ×).
- A 64px paper scrim between the sheet and the tab bar hides scrolled content.

**Generic bottom sheet:** `--card`, top radius 24, 36×5 grabber in `--rule-2`, `--shadow-2`, page scrim `rgba(12,15,19,.40)`.

**Tab bar:** 83px (49 + 34 safe area), 5 equal columns, 24px icon + cond 700 11px label, inactive `--ink-3`. Active: a 54×30 r15 pill in `--ink` with the icon in `--paper`, label `--ink`. Home indicator 134×5.

**Avatar:** a solid member-colour disc, initials in `--on-member` (cond 800, ~0.44× diameter), a 150° white sheen (28%→0). Sizes 20 · 24 · 32 · 36 · 40 · 44 · 48 · 56. Stacked avatars overlap by 8px with a 2px `--paper` ring.

**Section header:** section title + a flexible 1px `--rule-2` rule + a right-aligned link (body 600 13px `--ink-2`, chevron).

**Coach pull quote:** no card. A 2px `--ink` left rule, Literata italic 15px, and an attribution row (20px avatar, name bold, meta muted).

**Head-to-head fight card:**
- Period eyebrow and "Change rival".
- Three-column poster: each side is an avatar over a name and goal; the centre holds the 64px score and "X leads".
- Seven-cell tally bar (6px, 2px gaps, member colours).
- Centred "Tale of the tape" eyebrow between ink rules.
- 29px rows: `value | bar ← | label | → bar | value`.
  - Bars grow outward from the label, length ∝ value ÷ row max.
  - Leader: 6px bar, value in ink 800. Trailer: 3px bar, value in `--ink-3` 700.
- A footnote explains any non-obvious metric.

**Meal row:** 44px minimum. 44px hit target around a 24px r7 checkbox (done = ink fill + tick). Name 14px 700 over details 11.5px `--ink-3`, with the time right-aligned. "Next" row: `--card-2` highlight + an ink "NEXT" tag.

**Attachment row:** `--card-2`, r14, PDF glyph (32×36, dog-ear corner, ink "PDF" label), name and meta, 44px download button.

**Weight stepper:** 50px round-rect − / + (r15, `--card-2`), value in disp 900 40px, Ink "Save".

---

## 6. Charts

- Surface = `--card`. Lines 2px, round caps and joins. End and marker dots r ≥ 4 (8px), filled with the series colour plus a 2px `--card` stroke ring.
- Area fills: series colour at 10% opacity.
- Gridlines: 1px solid `--grid`, `shape-rendering: crispEdges`. Baseline: `--rule-2`. Never dashed.
- Axis text: cond 600 10.5px `--ink-3`, tabular. Direct end labels: cond 800 12px `--ink`, only at series ends.
- Bars ≤ 24px thick (spec uses 14), 4px rounded data-end, square baseline, 2px surface gap between neighbours.
- One y-axis only. A legend is always present for ≥ 2 series (8px dot + ink label), placed in the card header.
- Reference lines (the weight goal) are **solid** 1.25px `--ink-2`, with a pill label ("Goal 78.0 kg") and a bold axis tick.
- Event markers (program start) are a 1px `--rule-2` vertical with a 10px label.
- Weight chart: daily weigh-ins as hollow 6.5px circles (1.5px member stroke at 55%); the smoothed EMA trend (α = 0.2) as the 2px line + 10% area; the end dot is labelled.
- Race chart: cumulative sessions as step-after lines per member, week separators as gridlines.
- Lift chart: weekly e1RM (Epley) lines with markers.
- Sparkline: 140×34, trend line + area + end dot, no axes.
- Each mark carries an SVG `<title>` for the hover tooltip; production adds a crosshair tooltip.
