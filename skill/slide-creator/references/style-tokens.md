# Style tokens (style.json reference)

`style.json` is the only place a style's visual values live. The build turns it into:

- `build/theme.css` — CSS variables + `assets/base.css` + the style's `style.css`
- `build/d2-header.d2` — diagram classes
- `build/chart-config.json` — Vega-Lite config
- `build/tokens.json` — resolved tokens (handy for checking derived colours)

## Shape of the file

```jsonc
{
  "name": "boardroom",                 // folder name, kebab-case
  "label": "Boardroom",
  "summary": "One or two sentences on the look.",
  "bestFor": ["…"],
  "kind": "document",                         // optional: "document" (read, e.g. whitepaper) vs slides (default); new.mjs picks the starter from it
  "page": { "width": 1280, "height": 720 },   // optional page size in px (96 per inch); 1056 × 816 = US Letter landscape
  "markdown": { "breaks": false },            // optional markdown-it options; breaks:false lets wrapped prose reflow
  "samples": { "example": "showcase", "reference": [1, 3, 4, 5, 7, 8] },  // optional, maintainers: example + pages for the repo gallery
  "schemes": {                         // one or more colour schemes; "default" is required
    "default": {
      "bg": "#FFFFFF",      // page
      "surface": "#F2F4F7", // panels, cards, diagram groups, code
      "ink": "#1A2230",     // main text
      "muted": "#5C6677",   // secondary text, axis labels, captions
      "rule": "#D3D9E2",    // hairlines, gridlines, de-emphasised chart marks
      "primary": "#0B2A4A", // brand structure: bars, title colour, main series
      "accent": "#00808A",  // the highlight — sparingly
      "good": "#2E7D4F", "warn": "#C77700", "bad": "#B42318", "info": "#1F5FA8",
      "categorical": ["…6 colours, most important first…"],
      "sequential": ["#light", "#dark"]
    },
    "dark": { "…same roles…" }
  },
  "type": {
    "heading": { "family": ["Aptos Display", "Segoe UI", "Arial", "sans-serif"], "weight": 600, "tracking": "-0.01em", "case": "none" },
    "body":    { "family": ["Aptos", "Segoe UI", "Arial", "sans-serif"], "weight": 400 },
    "mono":    { "family": ["Cascadia Mono", "Consolas", "monospace"] },
    "label":   { "font": "body | heading | mono", "weight": 700, "tracking": "0.04em", "case": "uppercase | none" },
               // or "family": [...] to give labels, subheads (document styles) and chart titles their own font
    "scale":   { "display": 64, "h1": 48, "h2": 34, "h3": 22, "body": 22, "small": 18, "caption": 14, "label": 14 },
    "lineHeight": { "tight": 1.15, "body": 1.45 },
    "measure": "40em"                  // max line length for paragraphs
  },
  "space": { "unit": 8, "margin": [72, 64, 72, 64], "gutter": 40, "safe": 32 },
  "shape": { "radius": 4, "radiusLarge": 6, "rule": 1, "ruleStrong": 3, "shadow": "none" },
  "diagram": { "layoutEngine": "elk", "pad": 24, "fontSize": 17, "stroke": 1, "radius": 4,
               "nodeFill": "surface", "nodeStroke": "rule", "groupStroke": "rule", "groupDash": 0,
               "monoLabels": false, "sketch": false },
  "chart": { "grid": "y | x | both | none", "fontSize": 14, "barRadius": 0, "lineWidth": 2.5,
             "emphasis": "primary", "deemphasis": "rule" },
  "rules": { "maxWords": 60, "maxBullets": 5, "maxAccentsPerSlide": 2, "minFontPx": 13,
             "titleStyle": "action | phrase", "photos": "…", "icons": "…" },
  "extraClasses": []                   // optional: extra classes this style's CSS defines
}
```

Units: px on the page (1280×720 unless `page` says otherwise). `chart.width` / `chart.height` set the default chart size (default 1000×420); `rules.maxBlocks` the crowding limit (default 7); `rules.minFigureFontPx` the smallest text allowed inside a diagram or chart after scaling (default 80% of `minFontPx`). `diagram.stroke` must be a whole number (D2 rejects fractions; it is rounded). Colour-role names (`"surface"`, `"rule"`) are accepted wherever a colour is.

## Deck knobs

Set these in `slides.json`:

```json
{
  "density": "roomy",
  "page": "4:3",
  "logo": "images/logo.svg",
  "logoDark": "images/logo-dark.svg"
}
```

`density` defaults to `standard`. `roomy` makes type 8% larger, unit/gutter 15% wider, the word limit 10% lower and the bullet limit 20% lower. `compact` makes type 9% smaller, unit/gutter 14% tighter and the limits 20% higher. Margins move only a little. These values are derived together by `resolveTokens()` so a deck stays consistent. Compact is for more data per slide; roomy is for a talk with little text. The style's original values are the standard setting.

`page` accepts `16:9` (1280×720), `4:3` (1280×960), `letter` (1056×816), `a4` (1123×794), `letter-portrait` (816×1056), `a4-portrait` (794×1123), or `{ "width": 900, "height": 600 }` in CSS pixels. The presets use 96 pixels per inch. A style's own page is used when the deck omits this knob. Use slide styles on 16:9 or 4:3, and document styles on letter or A4.

`logo` is a local SVG or PNG; `logoDark` is the light artwork for a dark cover. The builder embeds both locally on cover and closing pages. Each style sets `"logo": { "position": "top-right", "height": 42 }` and may choose top/bottom and left/right. A style may set `"content": "top" | "center"`; center spreads short KPI, steps, timeline and comparison bodies into the space below the title. The inspector warns `top-heavy` if body content ends above roughly 55% of a content slide.

## Derived automatically (don't add unless overriding)

| Token | Rule |
|---|---|
| `onPrimary`, `onAccent`, `onGood` … | white or near-black, whichever contrasts more with the fill |
| `accentText`, `warnText`, `goodText`, `badText`, `infoText` | the colour itself if it reaches 4.5:1 on `bg` and `surface`, else darkened toward `ink` until it does |
| `accentSoft` | accent at 28% opacity (highlighter) |
| `onNode` | diagram box label colour: `ink` if it reads on `diagram.nodeFill`, else white or the darker of `ink`/`bg` |

## CSS variables available to style.css

Colours: `--bg --surface --ink --muted --rule --primary --on-primary --accent --on-accent --accent-text
--accent-soft --good --warn --bad --info --on-good --on-warn --on-bad --on-info --good-text --warn-text
--bad-text --info-text --cat-1 … --cat-6`

Type: `--font-heading --font-body --font-mono --font-label --weight-heading --weight-body --weight-label
--tracking-heading --tracking-label --case-heading --case-label --fs-display --fs-h1 --fs-h2 --fs-h3
--fs-body --fs-small --fs-caption --fs-label --lh-tight --lh-body --measure`

Space & shape: `--u --m-top --m-right --m-bottom --m-left --gutter --safe --radius --radius-lg --rule-w
--rule-w-strong --bar-w --shadow`

Hooks a style may set on `section`: `--bullet` (bullet character), `--bullet-color`, `--source-prefix`,
and may override `--accent-text` (e.g. to `var(--ink)` when accent is a fill-only colour).

## Per-deck overrides (slides.json)

```json
{
  "style": "boardroom",
  "scheme": "default",
  "overrides": {
    "colors": { "primary": "#5A0F2E", "accent": "#D4A017" },
    "type": { "heading": { "family": ["Georgia", "serif"] } },
    "rules": { "maxWords": 70 }
  }
}
```
