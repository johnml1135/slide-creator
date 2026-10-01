---
name: slide-creator
description: Create polished slide decks (PDF, or image-based PowerPoint) from Markdown with Marp, with on-style D2 diagrams and Vega-Lite charts, three built-in visual styles (editorial, boardroom, plant-floor), automatic inspection of the rendered slides and assessment against the style. Use when the user asks for a presentation, slide deck, slides, a pitch or review deck, diagrams or charts for slides, to restyle or recolour a deck, to check a deck's design, or to create or import a presentation style from an existing PowerPoint or PDF.
compatibility: Needs Node.js 18+ (npm install in this folder), an installed Microsoft Edge or Google Chrome for rendering, and Python 3.9+ only for style import.
---

# slide-creator

You make slides that look designed, without needing to see well: **content goes in Markdown, every visual
decision comes from a style pack**, and the rendered result is inspected and checked before you hand it over.

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
   Look at `<skill>/samples/<style>.pdf` if you need to show the user the options.
2. **Read the style.** `<skill>/styles/<style>/guide.md`, and look at 2–3 images in its `reference/` folder.
3. **Create the project** (skip if it exists):
   ```
   node <skill>/scripts/new.mjs <folder> --style <style>
   ```
   This makes `slides.json`, `deck.md`, `diagrams/`, `charts/`, `images/`.
4. **Write the story first**: one slide title per line, each title a complete thought. Check the flow reads
   as an argument, then build each slide with a layout from `references/layouts.md`.
5. **Diagrams and charts**: write `diagrams/<name>.d2` (see `references/diagrams.md`) and
   `charts/<name>.vl.json` (see `references/charts.md`), and reference them as `diagrams/<name>.svg` /
   `charts/<name>.svg` in the deck.
6. **Build and inspect**:
   ```
   node <skill>/scripts/build.mjs <folder>
   ```
   Produces `build/deck.pdf`, `build/slides/slide-NN.png`, `build/contact-sheet.png` and `build/report.md`.
7. **Assess** (`references/assessment-rubric.md`):
   - Fix every ✗ error in `report.md`.
   - Open `build/contact-sheet.png`, then every `build/slides/slide-NN.issues.png` named in the report,
     and 3 other slides at full size. Score the rubric; anything under 4 gets fixed.
   - Rebuild. Stop after 3 rounds and tell the user what is still imperfect.
8. **Deliver**: `build/deck.pdf` (add `--pptx` for PowerPoint — note each slide is an image in that file).
   Give a short summary: style used, slide count, anything you could not fix.

## Hard rules

- **No colours, fonts or sizes in the deck, diagrams or charts.** No `style=""`, no `<style>`, no hex codes.
  Charts may use colour tokens like `"$accent"`. Everything else comes from the style.
- **Only the classes in `references/layouts.md`.** Unknown classes are lint errors.
- **One idea per slide**; respect the style's word and bullet limits (the linter enforces them).
- **One focal point per slide**: one `key` node per diagram, one highlighted series per chart,
  one `.kpi.key` per KPI row.
- Put detail in speaker notes (`<!-- note -->` comments at the end of a slide), not on the slide.
- Keep proprietary data local; never paste it into web tools or online diagram renderers.

## Changing how things look

- **Recolour one deck**: in its `slides.json` add `"overrides": { "colors": { "primary": "#…", "accent": "#…" } }`.
- **Dark version**: `"scheme": "dark"` (every built-in style has one).
- **Different style**: `"style": "<name>"` or `--style <name>` on the build command.
- **New or imported style, or changing a style itself**: follow `workflows/new-style.md`.

## Files

| Path | What |
|---|---|
| `styles/<name>/` | style packs: `style.json` tokens, `style.css` personality, `guide.md`, `reference/` |
| `assets/base.css` | shared layouts and components (all styles) |
| `scripts/build.mjs` | full build: style → theme, D2, charts, icons, Marp, inspection |
| `scripts/inspect.mjs` / `lint.mjs` | inspection and checks only |
| `scripts/new.mjs` | new deck project |
| `scripts/import_style.py` | draft a style from a .pptx/.pdf |
| `scripts/doctor.mjs` | environment check |
| `references/` | layouts, tokens, diagrams, charts, rubric, design basics |
| `workflows/new-style.md` | create, import or change a style |
| `examples/showcase/` | one deck that uses every layout — the test deck for any style |
| `samples/` | showcase rendered in each built-in style |
