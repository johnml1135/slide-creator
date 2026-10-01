# CLAUDE.md — slide-creator

Context for anyone (human or agent) continuing work on this repo.

## What this is

An agent skill (`skill/slide-creator/`) that lets GitHub Copilot agents (and Claude) produce well-designed
slide decks from Markdown: Marp for slides, D2 for diagrams, Vega-Lite for charts, Lucide icons, and a
Playwright-driven inspector that renders every slide to PNG and checks layout. Presentation rendering decisions come
from **style packs** (`styles/<name>/style.json` + `style.css` + `guide.md`), so agents with weak visual
ability still produce on-style output.

## Who uses it, and the constraints that shaped it

- Primary users: GitHub Copilot agents on **locked-down corporate Windows PCs**. Only **npm, Node and
  Python (pip)** can be installed. No admin rights, no system installs, possibly no Chromium download.
- Rendering therefore uses the **already-installed Edge or Chrome** (`findBrowser()` in
  `scripts/lib/project.mjs`; override with `SLIDE_BROWSER`). Never add a dependency that needs a system
  install (LibreOffice, Graphviz, D2 binary, Inkscape…).
- Decks may contain **proprietary data**: nothing may call web services at build time (no Kroki, no
  remote fonts/images required). Keep it offline.
- Target fonts are what ships with Windows/Office: Aptos, Segoe UI, Georgia, Bahnschrift, Consolas,
  Cascadia Mono — always with fallbacks.
- Output is **PDF only** (decided 2026-10-01). People edit `deck.md` and rebuild; no PowerPoint output is
  planned. (`--pptx` still passes through to Marp but is undocumented: image-only slides.)

## Relationship to Impeccable

The user chose a thin presentation layer beside Impeccable (2026-10-01). Impeccable owns general design
and critique when available; this repo owns the offline presentation compiler, shared style tokens,
local data/asset handling, PDF export and slide-specific inspection. Do not build a competing general
design command suite. `references/impeccable.md` explains optional setup and the review handoff emitted
by inspection as `build/design-review.md`. No native Impeccable engine is required for deck builds.

## Architecture

```
style.json ──► scripts/lib/style.mjs ──► build/theme.css        (CSS vars + assets/base.css + style.css)
                                     ├─► build/d2-header.d2     (prepended to every diagram)
                                     ├─► build/chart-config.json (Vega-Lite config)
                                     └─► build/tokens.json      (resolved + derived colours)
deck.md ──► build.mjs (icons inlined) ──► Marp ──► <deck-name>.pdf + inspect.html (--template bare)
diagrams/*.d2 ──► @terrastruct/d2 (WASM) ──► build/diagrams/*.svg
charts/*.vl.json ──► vega-lite + vega (renderer none → SVG) ──► build/charts/*.svg
inspect.html ──► inspect.mjs (Playwright) ──► slides/*.png, *.issues.png, contact-sheet.png, report.{md,json}
                 lint.mjs (static checks on sources) ──┘
```

Key invariants — keep them:
- **No literal colours/fonts outside `style.json`.** `base.css` and `style.css` use only CSS variables;
  decks/diagrams/charts are linted for hex codes. Charts use `"$token"` strings (`resolveTokenRefs`).
- **One shared vocabulary.** Layout and component classes live in `assets/base.css`; the allowed list is
  `SLIDE_CLASSES` / `COMPONENT_CLASSES` in `scripts/lint.mjs` and documented in `references/layouts.md`.
  Adding a component means updating all three. Styles may only restyle, not invent classes
  (unless listed in `extraClasses`).
- **Derived colours** (`onAccent`, `accentText`, `goodText`…) are computed for contrast in
  `resolveTokens()`; text uses `--accent-text`, fills use `--accent`.
- D2 diagram classes: `box key quiet group link good warn bad info note` (`DIAGRAM_CLASSES`).

## Status (v0.1, 2026-10-01)

**Runs end to end on Windows + Edge**: Marp (PDF + `--template bare` inspection HTML), D2 WASM, Vega 6 /
Vega-Lite 6 (inline, CSV or .xlsx data), Lucide inlining, inspector, linter, live preview (`--watch`).
`build()` is a module (`scripts/build.mjs`); the CLI is a thin adapter. PDFs are named after the deck and get
bookmarks + metadata (`scripts/pdf.mjs`). `scripts/install.mjs` installs the skill into a repo
(`.github/skills/`, plus VS Code tasks and Copilot prompt files) or `~/.copilot/skills/`.

Styles: slides `editorial`, `boardroom`, `plant-floor`, `keynote`, `minimal`; documents (`kind: "document"`)
`editorial-whitepaper` (Letter landscape, two-column `paper` layout) and `report` (Letter portrait).
Visual assets: `illustrations/*.svg` are validated and inlined with scoped IDs and alt-derived accessible
names; style tokens drive fills/fonts. `icon.stroke` and `image` control optional photo framing, crop,
tint, duotone and overlays. Inspector checks raster enlargement and flags unverified image/gradient contrast.
`examples/visual-story` and the reviewed layer-stack template demonstrate reuse; complex artwork is supplied
locally. See `references/visuals.md` and `references/visual-quality.md`.

Deck knobs in slides.json: `density`, `page`, `logo`/`logoDark`. Examples: showcase, whitepaper, report,
exec-summary.

Repo layout: `skill/slide-creator/` is ONLY what gets installed (no PDFs or images). `gallery/` holds the
rendered PDFs, contact sheets and README hero images; `dev/` holds maintainer tools (`samples.mjs`, `tests/`),
run from the repo root with `npm run samples` and `npm test`.

Integration facts learned the hard way (keep them):
- Marp's bare template clamps `html/body` height; the inspector un-clamps it or every slide after the first
  screenshots as background.
- Every slide sits inside Marp's `<svg>`; checks that skip "text inside SVG" must only skip SVGs *inside*
  the section.
- Marpit sets `section::after { padding: inherit }` — reset it or the page number moves in by the margins.
- Marp reads slide size from literal `width/height` on the root `section` rule (emitted from `page` tokens).
- `@terrastruct/d2` runs in a worker thread: `d2.worker.terminate()` or the process never exits. D2 only
  accepts whole-number `stroke-width`. Its errors are a JSON array of `{range, errmsg}`.
- d2/vega/vega-lite hide `package.json` behind `exports`; use `packageDir()`, not `resolve('<pkg>/package.json')`.
- In dark schemes `ink` is light: derived "text on a fill" colours must pick the darker of `ink`/`bg`.
- Markdown `breaks` is on in Marp by default; document styles set `"markdown": {"breaks": false}`.

Rendering from WSL: Node 24 is installed through nvm; this machine has no Linux browser. Windows Node
and installed Edge passed doctor and render tests using `/mnt/c/Program Files/nodejs/node.exe` from WSL
(with interop permitted). A Linux browser download was unreachable; corporate users still use installed Edge.

## Next steps (suggested order)

1. Try it in a real GitHub Copilot session in VS Code on a locked-down PC, and on the cloud agent's Linux runner
   (Chrome, no Windows fonts); fix what breaks.
2. A check registry in inspect.mjs (one entry per check) so checks can be tuned per style.
3. Denser report example pages (content pages end half-way down); a JSON Schema for `style.json`.
   (Review canvas with diagrams: "slide-creator review" in Claude Design, 2026-10-01.)

## Working on this repo

- Node ESM scripts, no build step. Python only in `scripts/import_style.py`.
- Test a style change quickly: `node skill/slide-creator/scripts/build.mjs skill/slide-creator/examples/showcase --style <name>`
  (`examples/whitepaper` for document styles; `--slides 3,5` for a few slides) then open
  `build/contact-sheet.png`. **Always look at the rendered slides**, not just the report.
- While editing `deck.md`, run `node skill/slide-creator/scripts/build.mjs <project> --watch` and open the
  printed local URL. Saves refresh the HTML preview and show lint findings; run a full build for the PDF.
- Before committing style or pipeline changes, from the repo root: `npm test` must pass and `npm run samples`
  (all styles, light + dark) must end "All samples clean"; commit the regenerated `gallery/` files.
- Re-run only the inspection on an existing build: `node skill/slide-creator/scripts/inspect.mjs <project>`.
- The user is not a designer: explain design choices in plain words; keep `references/design-basics.md` current.
