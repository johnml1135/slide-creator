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

## Status (v0.1, first commit)

Verified (run and visually checked): style generator, all three styles in light + dark (plant-floor dark
checked), base layouts/components, inspector (screenshots, overlays, contact sheet, overflow/safe-area,
clipping, min font, contrast incl. section ::before bands), linter, `new.mjs`, `doctor.mjs`,
`import_style.py` on PDF and PPTX.

**Not yet run end-to-end** — npm was blocked where this was built:
- Marp CLI invocation in `build.mjs` (spawned via the package's `bin`, `CHROME_PATH` env for the browser,
  `--template bare` for inspection HTML). Verify the Marp HTML structure (`svg[data-marpit-svg] >
  foreignObject > section`) works with `measureSlides()` and the screenshot clipping.
- `@terrastruct/d2` JS API (`new D2().compile(src)` → `render(diagram, renderOptions)`), the generated
  header syntax (vars, `style.fill: transparent`, classes with `font: mono`), and whether
  `layout-engine: elk` is supported in the WASM build.
- Vega 6 / Vega-Lite 6 ESM imports and `view.toSVG()` in Node; `$token` replacement inside conditions.
- Lucide icon inlining (`lucide-static/icons/<name>.svg`).
- Versions in `package.json` are best guesses.

The **sample PDFs** in `samples/` and the `reference/` PNGs were produced by `dev/preview.py`, an offline
stand-in (python-markdown → HTML, simplified diagrams, matplotlib charts, substitute fonts). Regenerate with
the real pipeline: `cd skill/slide-creator && npm install && npm run samples`, then copy fresh slide PNGs into
each `styles/<name>/reference/`.

## Next steps (suggested order)

1. `npm install` in `skill/slide-creator`, `node scripts/doctor.mjs`, `npm run showcase`; fix whatever breaks
   in Marp/D2/Vega integration. Check `examples/showcase/build/report.md` and the contact sheet.
2. `npm run samples`; replace preview samples and reference images with real renders.
3. Inspector: add an orphan check (single word on a heading's last line) and a "figure too small" check
   (diagram/chart image < 60% of content width).
4. Add a `--watch` mode or a quick `--slides 3,5` partial build for faster iteration.
5. Phase 2 candidates: editable PPTX via PptxGenJS from the same tokens; a JSON Schema for `style.json`;
   more showcase decks (A3 report-out, exec summary) to test styles against.

## Working on this repo

- Node ESM scripts, no build step. Python only in `scripts/import_style.py` and `dev/`.
- Test a style change quickly: `node skill/slide-creator/scripts/build.mjs skill/slide-creator/examples/showcase --style <name>`
  then open `examples/showcase/build/contact-sheet.png`. **Always look at the rendered slides**, not just the report.
- Without Marp/D2/Vega available: `python3 dev/preview.py skill/slide-creator/examples/showcase --style <name> --pdf out.pdf`
  then `node skill/slide-creator/scripts/inspect.mjs skill/slide-creator/examples/showcase`.
- The user is not a designer: explain design choices in plain words; keep `references/design-basics.md` current.
