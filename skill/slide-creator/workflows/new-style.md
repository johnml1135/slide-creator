# Workflow: create or update a style

Use this when the user wants a new look (their company template, a deck they admire, a brand refresh)
or wants to change an existing style. A style is a folder:

```
styles/<name>/
├── style.json      tokens: colour schemes, type, spacing, shape, diagram, chart, rules   (REQUIRED)
├── style.css       personality: the few CSS rules that make it recognisable           (REQUIRED, may be short)
├── guide.md        the rules in words, for people and agents                           (REQUIRED)
├── reference/      PNGs of what "correct" looks like                                   (strongly recommended)
└── extraction.json raw measurements from import (only for imported styles)
```

Project styles live in `<deck project>/styles/<name>/` and override built-in styles of the same name.
To ship a style with the skill, put it in `<skill>/styles/<name>/`.

Never write colours or fonts anywhere except `style.json`. `style.css` may only use the CSS variables
listed in `references/style-tokens.md`.

---

## Path A — import from an existing presentation

1. **Get a PDF.** If the user has a .pptx, ask them to also export it to PDF from PowerPoint
   (File → Save As → PDF). Text measurements and reference images come from the PDF; theme colours and
   theme fonts come from the .pptx.
2. **Run the importer.**
   ```
   python <skill>/scripts/import_style.py company.pptx --pdf company.pdf --name acme --base boardroom --out <deck project>
   ```
   Pick `--base` closest in spirit: `editorial` (calm, serif, document-like), `boardroom` (corporate,
   action titles, navy), `plant-floor` (industrial, high contrast, header bar).
3. **Look before you trust.** Open 4–6 images in `styles/acme/reference/`. Compare them with the
   colours and fonts the importer printed and with `extraction.json`. Typical corrections:
   - `primary` vs `accent` swapped (primary = structural brand colour, accent = rare highlight).
   - `bg` picked up a photo or a dark title slide; most content pages decide `bg`.
   - Font names are PostScript names (`ArialMT`) — use the family (`Arial`) and keep fallbacks.
   - Type scale from a text-heavy deck can be too small for slides; body under 20px is too small.
4. Continue at **Finish a style** below.

## Path B — design a new style from a description

1. Ask (or infer) four things: *mood* (calm / corporate / technical / bold), *brand colours* (1 primary,
   1 accent, hex if known), *fonts available on their PCs*, *main use* (exec decisions, training, ops).
2. Copy the closest built-in style: `styles/<base>/` → `styles/<name>/` and set `name` and `label`.
3. Edit `style.json`, following **Token rules** below.
4. Continue at **Finish a style**.

## Path C — change an existing style

- **Recolour only** (most common): edit `schemes.default` (and `schemes.dark` if used), or — for one deck —
  add `"overrides": { "colors": { "accent": "#…" } }` to that deck's `slides.json`. Nothing else changes.
- **Add a colour scheme**: add `schemes.<scheme-name>` with every colour role; select it with
  `"scheme": "<scheme-name>"` in `slides.json`.
- **Change the look**: edit `style.css` and `guide.md` together, then run the checks below on the showcase.

---

## Token rules (style.json)

- **Colour roles** (all required in every scheme): `bg, surface, ink, muted, rule, primary, accent,
  good, warn, bad, info`, plus `categorical` (6 colours) and `sequential` ([light, dark]).
  - `ink` on `bg` ≥ 7:1, `muted` on `bg` ≥ 4.5:1. `surface` is a slight shift from `bg` (3–8%).
  - `accent` is used sparingly; if it is a light colour (amber, yellow), treat it as a fill only and set
    `section { --accent-text: var(--ink); }` in `style.css` (see plant-floor).
  - `categorical[0]` is the default series colour; order the rest from most to least important.
  - Text-on-colour colours (`onPrimary`, `onAccent`, …) and readable text variants are derived
    automatically — don't add them unless the automatic choice is wrong.
- **Type**: `heading`, `body`, `mono` each a font stack whose first entry is installed on the target PCs;
  `scale` in px on a 1280×720 slide. Sensible ranges: body 20–28, h2 32–46, h1 46–68, display 60–90,
  caption ≥ 13.
- **Space**: `margin` [top, right, bottom, left] 56–110 px; `gutter` 32–64; `safe` 24–40.
- **Shape**: `radius` 0–12. Square (0–2) reads technical; 4–8 reads modern; 12+ reads playful.
- **Diagram**: `stroke` 1–2, `radius`, `nodeFill` (a colour role name or hex), `nodeStroke`,
  `groupStroke`, `monoLabels`. Keep diagram corners the same as cards.
- **Chart**: `grid` (y | x | both | none), `barRadius`, `emphasis` / `deemphasis` colour roles.
- **Rules**: `maxWords`, `maxBullets`, `minFontPx`, `titleStyle` (`phrase` or `action`) — these drive the linter.

## Personality rules (style.css)

A style is recognisable from 3–6 *signatures*. Express each one in CSS using existing classes only:

| Signature idea | Where | Example |
|---|---|---|
| Title treatment | `h2` | hairline under it, colour, case, size |
| Top/bottom band | `section::before` | brand bar, header strip |
| Section dividers | `section.chapter` | full colour, big number, photo |
| Cover | `section.cover` | colour block, stripe, low title |
| Bullets | `--bullet`, `ul > li::before` | dash, square, dot |
| Numbers | `.kpi`, `.stat` | colour, font, tile vs rule |
| Tables | `th`, `td` | dark header row vs hairline |
| Labels | `h6`, `.tag`, `.callout > b` | mono, small caps, colour |

Don't add new class names; if a genuinely new component is needed, add it to `assets/base.css`, list it in
`references/layouts.md` and in `COMPONENT_CLASSES` in `scripts/lint.mjs`, so every style supports it.

---

## Finish a style (all paths)

1. **Build the showcase** in the new style:
   ```
   node <skill>/scripts/build.mjs <skill>/examples/showcase --style <name> --out build-<name>
   ```
2. **Inspect.** Fix every error in `build-<name>/report.md`. Look at `contact-sheet.png`.
3. **Compare with the source.** Put a reference image and the matching showcase slide side by side
   (cover vs cover, content vs content, chart vs chart). List the 3 biggest differences, fix them in
   `style.json` / `style.css`, rebuild. Repeat up to 3 times.
4. **Check both schemes** if the style has `dark`: `--scheme dark`.
5. **Write `guide.md`** — replace every TODO. Agents read this before making slides, so state rules
   plainly ("accent only on the single most important number").
6. **Save reference images**: copy the 4–6 best showcase slides into `reference/` as
   `showcase-NN.png` (keep the source pages too).
7. **Sample PDF** (built-in styles only): `npm run samples` regenerates `samples/<name>.pdf`.
8. Tell the user what was extracted, what you changed by eye, and anything you could not match
   (e.g. a font not installed, photo-based layouts).
