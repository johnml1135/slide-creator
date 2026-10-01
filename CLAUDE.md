# CLAUDE.md — slide-creator

Context for anyone (human or agent) continuing work on this repo.

## What this is

An agent skill (`skill/slide-creator/`) that lets GitHub Copilot agents (and Claude) produce well-designed
slide decks from Markdown: Marp for slides, D2 for diagrams, Vega-Lite for charts, Lucide icons, and a
Playwright-driven inspector that renders every slide to PNG and checks layout. Visual decisions come only
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
- Output priority: PDF first. Marp's `--pptx` is image-based; editable PPTX (PptxGenJS from the same
  tokens) is a possible phase 2.

## Architecture

```
style.json ──► scripts/lib/style.mjs ──► build/theme.css        (CSS vars + assets/base.css + style.css)
                                     ├─► build/d2-header.d2     (prepended to every diagram)
                                     ├─► build/chart-config.json (Vega-Lite config)
                                     └─► build/tokens.json      (resolved + derived colours)
deck.md ──► build.mjs (icons inlined) ──► Marp ──► deck.pdf / deck.pptx + inspect.html (--template bare)
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

**Runs end to end on Windows + Edge**: Marp (PDF/PPTX + `--template bare` inspection HTML), D2 WASM, Vega 6 /
Vega-Lite 6, Lucide inlining, inspector, linter. Samples (`samples/`, light + dark) and every style's
`reference/` images are real renders from `npm run samples`. `scripts/install.mjs` installs the skill into a
repo (`.github/skills/`), `~/.copilot/skills/` or any folder, optionally with `copilot-setup-steps.yml`.

Styles: `editorial`, `boardroom`, `plant-floor` (16:9 slides) and `editorial-whitepaper` (a **document**
style: US Letter landscape pages, `paper` two-column layout, `kind: "document"`, own example
`examples/whitepaper`).

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

## Next steps (suggested order)

1. Phase 2: editable PPTX via PptxGenJS from the same tokens; a JSON Schema for `style.json`.
2. More example decks to test styles against (A3 report-out, exec summary); a document-style variant of
   boardroom if users want branded reports.
3. `--watch` mode (`--slides` partial builds exist).
4. Check fonts/rendering on the Linux runner used by Copilot cloud agent (Chrome, no Windows fonts).

## Working on this repo

- Node ESM scripts, no build step. Python only in `scripts/import_style.py`.
- Test a style change quickly: `node skill/slide-creator/scripts/build.mjs skill/slide-creator/examples/showcase --style <name>`
  (`examples/whitepaper` for document styles; `--slides 3,5` for a few slides) then open
  `build/contact-sheet.png`. **Always look at the rendered slides**, not just the report.
- Before committing style or pipeline changes: `npm run samples` (all styles, light + dark) must report
  0 errors / 0 warnings, and commit the regenerated samples and reference images.
- Re-run only the inspection on an existing build: `node skill/slide-creator/scripts/inspect.mjs <project>`.
- The user is not a designer: explain design choices in plain words; keep `references/design-basics.md` current.
