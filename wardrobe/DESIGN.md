# DESIGN.md: Fitfn Wardrobe, brutalist cream

Adapted from the "FORM" neon-brutalist brief (The Verge / Pitchfork lineage,
cream variant; Balenciaga.com × Bloomberg Businessweek). Anti-polish, raw,
deliberate. Ugliness as craft, applied to a phone-first wardrobe app.

This file is the source of truth for every screen. The shared primitives in
`src/components/ui.jsx`, `Pieces.jsx`, `Header.jsx` and `src/index.css`
already implement it; screens compose them.

## Palette (three colours, nothing else)

| Token | Value | Use |
|---|---|---|
| `page` / `surface` | `#f0ebe0` raw cream | every background |
| `ink` | `#0a0a0a` | text, every border, selected states, the black board behind outfit photos |
| `accent` | `#e8000d` raw red | the ONE main CTA per screen, and ONE number per section. Nowhere else. |
| `on-accent` | `#ffffff` | text on red (4.8:1) |
| `muted` | `#57534b` | secondary Courier text only (an ink tint, ≥ 6:1 on cream) |
| `raised` | `#dcd7cb` | photo placeholders only (darkened cream, not a new hue) |

No greens, no oranges, no teal. Errors, warnings and success are told apart by
their **words** (`ERROR`, `WAIT`, `DONE`), not colour. Single theme: the page
is cream for every viewer, on purpose.

## Type

- **Display:** Impact, uppercase, weight 400 (Impact has one weight; never
  faux-bold it). Fallback Anton (Google Fonts, same proportions) for phones
  without Impact. Class: `.display`. Line height 0.86.
- **Everything else:** Courier New, including body copy, labels, inputs and
  buttons' small text. Fallback Courier Prime. Class: default body font.
- **Small metadata:** `.meta` (Courier, 12px, uppercase, 0.04em tracking).
- Page titles: `clamp(72px, 14vw, 160px)` via `PageTitle`. Intentionally
  extreme. They may wrap to two lines on phones; that's fine.
- Section titles: `Section` (Impact, 40-64px).

## Brutalist rules (absolute)

1. Every border is **4px solid #0a0a0a**: Tailwind `border-4 border-ink`
   (or `border-t-4`, `border-x-4`…). Never 1px, 1.5px or 2px.
2. **No border-radius anywhere.** No `rounded-*` classes. Swatches are squares.
3. **No shadows, no gradients, no blur, no glass.** No `shadow-*`,
   `bg-gradient`, `backdrop-blur`, `ring-*`.
4. **No icon libraries.** No Phosphor, no Lucide, no SVG icons. Use words and
   plain typographic glyphs: `+  →  ←  ×  ↑  ↓  ✓  /`. (Not ♥: it renders as
   an emoji on iPhones.)
5. **Nothing smooth.** No `transition-*`, `duration-*`, `ease-*`. State
   changes are instant. Entrances, where kept, use stepped timing
   (`steps(n)`).
6. **Hover = `filter: invert(1)`** on every button, link and select, applied
   globally in `index.css` (pointer devices only, so taps don't stick).
   Photos inside an inverted button are counter-inverted so they stay true.
   **Red elements never invert** (inverted red is teal, which is banned):
   they turn black on hover. Mark red buttons with `variant="primary"` on
   `Button`, which handles this.
7. **Red discipline:** per screen, red appears on the main CTA and at most one
   number per section (e.g. the look number `01`, the closet count, one stat).
   Selected chips, active tabs and secondary buttons are **black**.
8. **Asymmetric grid, deliberate misalignment:** stagger tiles (every second
   tile in a row drops ~48px), offset sub-lines from titles, use uneven
   column splits (`2fr 1fr`, `7fr 5fr`). Everything still stacks to one
   column under 768px where a layout is split.
9. **Press feedback:** `active:translate-x-[3px] active:translate-y-[3px]`
   (the thing physically drops), no shadow.
10. No em or en dashes in visible text. No emoji.

## Components (use these, don't re-roll)

- `Button` variants: `primary` (red, the screen's ONE main CTA), `black`
  (filled ink, cream text: strong secondary actions such as Wear today),
  `secondary` (4px ink outline on cream), `ghost` (text only, underlined).
- `Chip`: 4px box, Courier bold uppercase; selected = black fill.
- `Field`, `inputClass`: 4px border, cream fill, Courier 16px (16px also
  stops iPhone zoom-on-focus).
- `Sheet`: hard-edged panel, 4px ink frame, Impact title, solid scrim.
- `Notice` with `tone`: info / warn / error. A 4px box with an Impact
  prefix word.
- `PageTitle`, `Section`: giant Impact headings.
- `Marquee`: one per app, under the header, live closet numbers.
- `Spinner`: an ASCII spinner (`| / - \`) stepping, no rotation animation.
- `ItemImage`, `ItemTile`, `OutfitBoard` (Pieces.jsx): framed photos; the
  outfit flat-lay sits on a black board with 4px gaps.
- `GarmentType`: a missing photo becomes the garment's type set in Impact on
  a block of the piece's own colour.

## Layout

- Outer gutter 16px on phones; content max width 1200px.
- Sections are separated by full-width 4px rules or by 4px boxes, never by
  soft space alone.
- Desktop: uneven splits; phone: one column, rules unchanged.
