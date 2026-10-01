---
name: slide-creator
description: Create polished PDF slide decks and documents from Markdown with Marp, on-style D2 diagrams and Vega-Lite charts, seven built-in styles, and automatic visual inspection. Use for presentations, reports, specifications, audits, whitepapers, handouts, diagrams or charts, or to restyle or check a deck.
compatibility: Needs Node.js 18+ (npm install in this folder), an installed Microsoft Edge or Google Chrome for rendering, and Python 3.9+ only for style import.
---

# slide-creator

You provide the presentation production layer: **content in Markdown, shared style tokens, local assets,
PDF export, and checks on rendered slides**. When Impeccable is installed, use it for visual direction and
critique; see `references/impeccable.md`. Corporate requirements and the chosen style pack govern the output.
Do not recreate a general design command suite here.

`<skill>` below means the folder containing this file.

## One-time setup

```
npm install --prefix <skill>
node <skill>/scripts/doctor.mjs
```
`doctor` checks Node, the npm packages and the browser. If no browser is found, set `SLIDE_BROWSER` to the
path of `msedge.exe` or `chrome.exe`. For style import also run `pip install -r <skill>/requirements.txt`.

## The workflow (always follow it)

1. **Understand the ask.** Audience, decision or message, length, and which style. If unclear, pick:
   - `boardroom` — leadership, business cases, decisions, anything read without a presenter
   - `plant-floor` — operations, engineering, process, continuous improvement, project status
   - `editorial` — explainers, guides, training, strategy narratives
   - `editorial-whitepaper` — a **document** to read, not present: whitepapers, playbooks, pre-reads,
     handouts; US Letter pages, two columns, ~350–550 words a page (see `references/design-basics.md`,
     "Slides or a document?"). Its guide replaces the slide writing limits.
   - `report` — a **document** for formal reports, specifications and audits: US Letter portrait, one column, numbered sections, running header and page numbers.
   - `keynote` — dark-first slides for live talks, town halls and announcements: very large type and one idea per slide; use `light` for a pale scheme.
   - `minimal` — a safe corporate slide default: black on white, strict grid, Aptos/Segoe type and one accent.
   To show the user the options, point them to the gallery in the skill's GitHub repo (`gallery/`).
2. **Read the style and see it.** Read `<skill>/styles/<style>/guide.md`, then render its example once and look
   at 2–3 slides — that is what "on-style" looks like:
   `node <skill>/scripts/build.mjs <skill>/examples/showcase --style <style> --out build-<style> --html`
   (document styles: `examples/whitepaper` or `examples/report`). Open `build-<style>/contact-sheet.png`.
3. **Create the project** (skip if it exists):
   ```
   node <skill>/scripts/new.mjs <folder> --style <style>
   ```
   This makes `slides.json`, `deck.md`, `diagrams/`, `charts/`, `illustrations/`, `images/`.
4. **Write the story first**: one slide title per line, each title a complete thought. Check the flow reads
   as an argument, then build each slide with a layout from `references/layouts.md`.
5. **Diagrams and charts**: write `diagrams/<name>.d2` (see `references/diagrams.md`) and
   `charts/<name>.vl.json` (see `references/charts.md`), and reference them as `diagrams/<name>.svg` /
   `charts/<name>.svg` in the deck.
   If the numbers live in Excel, keep a `.xlsx` in the project's `data/` folder and set chart data to
   `{"url":"data/sales.xlsx","sheet":"Q3"}` (`sheet` optional). Row one supplies field names.
   For authored graphics, read `references/visuals.md`: place token-based SVGs in `illustrations/` and
   reference them with descriptive alternative text. Use the `photo` components for local photos.
   Read `references/visual-quality.md` before image-rich decks: write a visual brief, choose one dominant
   visual per key slide, and vary the page rhythm without changing the style. No image service is required.
6. **Build and inspect**:
   ```
   node <skill>/scripts/build.mjs <folder>
   ```
   Produces `build/<deck-name>.pdf`, `build/slides/slide-NN.png`, `build/contact-sheet.png` and `build/report.md`.
   While editing with the user, run `node <skill>/scripts/build.mjs <folder> --watch` and open its local URL
   in a browser or VS Code's **Simple Browser: Show**. It refreshes on saves and shows source lint findings.
   While fixing a few slides, `--slides 3,5-7` re-checks only those (about twice as fast, no PDF); do a
   full build before delivering.
7. **Assess** (`references/assessment-rubric.md`):
   - If Impeccable is available, give it `build/design-review.md` and the local rendered artifacts for
     critique. Translate findings into deck content, style tokens/CSS or approved assets, then rebuild.
     The handoff is guidance for the reviewing agent; the build does not invoke external tools.
   - Fix every ✗ error in `report.md`.
   - Open `build/contact-sheet.png`, then every `build/slides/slide-NN.issues.png` named in the report,
     and 3 other slides at full size. Score the rubric; anything under 4 gets fixed.
   - Rebuild. Stop after 3 rounds and tell the user what is still imperfect.
8. **Deliver**: `build/<deck-name>.pdf`. The Markdown is the editable source: to change the deck, edit `deck.md` and rebuild.
   Give a short summary: style used, slide count, anything you could not fix.

## Hard rules

- **No colours, fonts or sizes in the deck, diagrams or charts.** No `style=""`, no `<style>`, no hex codes.
  Charts may use colour tokens like `"$accent"`. Everything else comes from the style.
- **Only the classes in `references/layouts.md`.** Unknown classes are lint errors.
- **One idea per slide**; respect the style's word and bullet limits (the linter enforces them).
- **One focal point per slide**: one `key` node per diagram, one highlighted series per chart,
  one `.kpi.key` per KPI row.
- Put detail in speaker notes (`<!-- note -->` comments at the end of a slide), not on the slide.
- Treat `contrast-unverified` as a required visual review, never a passed contrast test. Inspect new image
  treatments in the exported PDF as well as the slide PNGs.
- Keep proprietary data local; never paste it into web tools or online diagram renderers.

## Changing how things look

- **Recolour one deck**: in its `slides.json` add `"overrides": { "colors": { "primary": "#…", "accent": "#…" } }`.
- **Dark version**: `"scheme": "dark"` (every built-in style has one).
- **Different style**: `"style": "<name>"` or `--style <name>` on the build command.
- **More or less room**: `"density": "roomy" | "standard" | "compact"` in `slides.json` (standard is the default). Roomy suits a short talk; compact suits detailed content that still reads at a glance.
- **Page shape**: `"page": "16:9" | "4:3" | "letter" | "a4" | "letter-portrait" | "a4-portrait"` or `{ "width": 900, "height": 600 }` in pixels. Use 4:3 for older screens and paper sizes for documents.
- **Logo**: set `"logo": "images/logo.svg"` and, for dark covers, optionally `"logoDark": "images/logo-dark.svg"`. The mark appears on cover and closing pages; the style controls its size and place.
- **New or imported style, or changing a style itself**: follow `workflows/new-style.md`.

## Files

| Path | What |
|---|---|
| `styles/<name>/` | style packs: `style.json` tokens, `style.css` personality, `guide.md` |
| `assets/base.css` | shared layouts and components (all styles) |
| `scripts/build.mjs` | full build: style → theme, D2, charts, icons, Marp, inspection |
| `scripts/inspect.mjs` / `lint.mjs` | inspection and checks only |
| `scripts/new.mjs` | new deck project |
| `scripts/import_style.py` | draft a style from a .pptx/.pdf |
| `scripts/doctor.mjs` | environment check |
| `references/` | layouts, tokens, diagrams, charts, rubric, design basics |
| `workflows/new-style.md` | create, import or change a style |
| `examples/showcase/` | one deck that uses every layout — the test deck for any style |
| `examples/exec-summary/` | seven-slide example that builds in every slide style |
| `examples/report/` | nine-page portrait report for the report style |
