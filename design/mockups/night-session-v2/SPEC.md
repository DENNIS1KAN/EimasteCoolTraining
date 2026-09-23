# Night Session v2: design refinement spec

A refinement of **Night Session**, not a replacement. The bones are unchanged: near-black blue-tinted
surfaces, huge condensed numerals, member colors reserved for identity, one volt accent for action.

v2 fixes four things the shipped system leaves on the table:

1. **The light theme loses the brand accent.** v1's own token file records the reason
   (`volt on white is 1.1:1`), so every accent *text* token falls back to ink-black. Light mode keeps
   volt only as a fill, which is why it reads as highlighter pen on paper.
2. **First-run is undesigned.** Every screen is laid out for full data. Once demo data stops shipping,
   day one is the first thing a new squad sees.
3. **The accent is spent everywhere.** Seven volt elements on one Home screen means none of them lead.
4. **The charts under-sell the payoff.** The weight trend is the emotional point of a cut and it is a hairline.

Reference implementation: `index.html`. Screenshots: `shot-dark.png`, `shot-light.png`.

---

## 1. Token changes

Only these differ from Night Session v1. Everything not listed is inherited unchanged.

### New tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--accent-text` | `#4D6B00` | `#D4FF3F` | **New.** The brand accent as readable text, icons and strokes. 6.1:1 on `--surface-1` in light, so it passes WCAG AA for small text in both themes. This is the token that gives light mode its accent back. |
| `--accent-surface` | `#0B1020` | `#161E04` | **New.** An accent *surface*. In light it is ink; in dark it is a volt-tinted near-black. |
| `--accent-on` | `#D4FF3F` | `#D4FF3F` | **New.** Text on `--accent-surface`. Volt in both themes. |
| `--card-lift` | `inset 0 1px 0 #FFFFFF` | `inset 0 1px 0 rgba(255,255,255,.035)` | **New in light.** The lit top edge that separates a card from the page. Dark already had this inside `--shadow-1`; light had no equivalent. |
| `--grain` | `.035` | `.05` | **New.** Opacity of the noise overlay. |

### Changed tokens

| Token | v1 | v2 | Why |
|---|---|---|---|
| `--bg` | `#F3F5F8` | `#EDF0F5` | White cards on `#F3F5F8` are ~1.09:1. Deepening the page is what makes a card look like a card. |
| `--card-border` (light) | `rgba(16,24,40,.045)` | `rgba(16,24,40,.09)` | 4.5% is invisible at phone brightness outdoors. |
| `--accent-soft` (light) | `rgba(212,255,63,.34)` | `rgba(112,150,0,.13)` | v1's is a highlighter band. A tonal tint of the *olive* accent reads as a state, not a marker pen. |

### Retired in light

`--accent-strong` and `--accent-ink`-as-text both existed only to say "volt is unreadable here, use ink".
`--accent-text` replaces them. `--accent-ink` keeps its real job: text **on** a volt fill.

---

## 2. The accent, rationed

**One volt fill per screen.** It marks the single primary action and nothing else.

| Role | Treatment |
|---|---|
| Primary action (Train anyway, Log weigh-in, Send) | `--accent` fill + `--accent-ink` text + `--shadow-accent` |
| Hero card | `--accent-surface` + `--accent-on` for the display numeral |
| State: streak, PR count, Active plan, "next" meal | `--accent-soft` background + `--accent-text` text |
| Emphasis in body copy | `--accent-text`, weight 800 |
| Everything else previously volt | `--surface-2` + `--ink-2` |

Applied to Home this takes seven volt elements down to two: the hero's numeral and the button inside it.

---

## 3. First-run states

Day one is a designed screen, not a full-data layout with the data missing.

- **Hero becomes a progress hero.** `1 of 3` in the display face, with the next action as the volt button.
  The numeral slot that later holds `REST` or `PULL` holds the setup count instead, so the layout never reflows.
- **Stat tiles hold their shape** and show an en-dash in `--ink-ph` rather than `0`. A zero is a result; a dash is "not yet".
- **Dashed empty boxes** (`--hairline-strong`, 1.5px dashed) say what will appear and when:
  *"Your trend line and goal ETA appear after the second one."* Never a bare "No data".
- **Squad shows the people, not the scores**, so the squad exists before anyone has trained.

Copy rule: an empty state names the thing that will fill it and the one action that fills it. Nothing else.

---

## 4. Charts

The weight trend is the payoff of a cut. Give it the weight of the numeral above it.

| Element | Spec |
|---|---|
| Trend line | 3px, `--m-<member>`, round caps, monotone curve |
| Area fill | Linear gradient of the member color, `.30` → `0`, top to bottom |
| Daily points | r=2.1, member color at `.34` opacity — present, never competing |
| Goal reference | 1.6px dashed `--accent-text`, labelled inline: `GOAL 79.0 kg · ETA 5 Nov` |
| Projection | 2.4px dashed continuation of the trend at `.5` opacity |
| Today marker | r=4.4 filled, 2px `--surface-1` ring, plus an r=9.5 halo at `.16` |
| Gridlines | `--grid`, 1px, three horizontal only. No vertical grid. |
| Axis text | `--ink-3`, 9px, weight 800 |

---

## 5. Head-to-head: diverge from a centre

Seven paired bars become one shared axis. Left of centre is the opponent, right is the viewer, and bar
length is **the margin**, not the value. A tie renders as an empty track, which is the point — you can
scan the column and see instantly where you are behind.

- Track: 13px tall, `--surface-2`, 7px radius
- Centre rule: 1.5px `--hairline-strong`, overhanging the track by 3px
- Fill: solid member color from the centre outward
- Values sit above at each end; the metric label is centred between them in `--ink-3`
- A dead-even row prints `Dead even` under the empty track

---

## 6. Texture and depth

- **Grain.** A tiled `feTurbulence` noise SVG at `--grain` opacity, `position:absolute; inset:0`,
  `pointer-events:none`, above content but below interactive layers. Stops large flat fills from banding.
- **Hero glow.** A 260×190 radial of `--accent-glow` at `.5`, bled off the top-right corner of the hero card.
- **Motion** (not in the static mockup): count-ups on stat tiles, spring on card mount,
  and the existing `celebrate.ts` confetti reserved for PRs and finishing a workout.

---

## 7. Tab bar at six

The Chat tab makes six items, and an even count cannot centre a raised button. Train therefore loses the
raised pedestal and keeps a volt icon instead; Home's `TodayWorkoutCard` remains the primary route into a
session. Below ~380px the bar drops labels and shows icons only.

This is the one v2 change that is reversible in isolation — if Chat does not ship, the five-tab raised
Train button stands as it is.
