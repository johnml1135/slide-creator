# slide-creator

An agent skill that lets GitHub Copilot (or Claude) make **properly designed slide decks** from Markdown —
with diagrams and charts that match, a check of the rendered result, and swappable visual styles.

Built for locked-down corporate PCs: everything installs with **npm** (plus optional **pip**), renders with
the **Edge or Chrome you already have**, and runs offline — nothing is sent to web services.

| | |
|---|---|
| **Slides** | [Marp](https://marp.app) Markdown → PDF (or image-based PPTX) |
| **Diagrams** | [D2](https://d2lang.com) via its npm (WebAssembly) build → SVG |
| **Charts** | [Vega-Lite](https://vega.github.io/vega-lite/) → SVG |
| **Icons** | [Lucide](https://lucide.dev) (offline SVGs) |
| **Inspection** | headless Edge/Chrome via Playwright: per-slide PNGs, contact sheet, layout & contrast checks |
| **Styles** | token-based style packs; three built in; import your own from a .pptx/.pdf |

## The three built-in styles

| Style | Feel | Use for | Sample |
|---|---|---|---|
| **editorial** | calm, book-like, serif titles, warm paper, one clay accent (inspired by Anthropic's skills guide) | explainers, training, strategy narratives | [PDF](skill/slide-creator/samples/editorial.pdf) |
| **boardroom** | consulting / executive: white, navy bar, action titles, strict grid | leadership updates, business cases, reviews | [PDF](skill/slide-creator/samples/boardroom.pdf) |
| **plant-floor** | industrial: header bar, condensed headings, mono labels, safety colours | operations, CI/A3, engineering, project status | [PDF](skill/slide-creator/samples/plant-floor.pdf) · [dark](skill/slide-creator/samples/plant-floor-dark.pdf) |

Every style has a light and a dark colour scheme, and any colour can be overridden per deck.

> The sample PDFs in this repo were rendered with an offline preview renderer (no Marp/D2/Vega available
> where they were made), using stand-in fonts and simplified diagrams. Run `npm run samples` in the skill
> folder to regenerate them with the real pipeline and your fonts.

## Install

**GitHub Copilot** — copy `skill/slide-creator/` to one of:
- `~/.copilot/skills/slide-creator/` (personal, all projects), or
- `<your repo>/.github/skills/slide-creator/` (one project)

**Claude Code** — copy it to `~/.claude/skills/slide-creator/`.
**Claude.ai** — zip the `slide-creator` folder and upload it under Settings → Capabilities → Skills.

Then, once:

```
cd <skill folder>
npm install
node scripts/doctor.mjs
pip install -r requirements.txt      # only for importing styles
```

If `doctor` can't find a browser, set `SLIDE_BROWSER` to the path of `msedge.exe` or `chrome.exe`.

## Use

Ask the agent, e.g. *"Make a 10-slide plant-floor deck on our Line 4 changeover results"* or
*"Import the style from template.pptx and rebuild this deck in it."* The skill tells it to:

1. scaffold a project (`scripts/new.mjs`), write the story, slides, diagrams and charts;
2. build (`scripts/build.mjs`) → `build/deck.pdf`, `build/slides/*.png`, `build/contact-sheet.png`, `build/report.md`;
3. fix errors from the report, look at the images, score them against the rubric, rebuild (≤3 rounds).

By hand:

```
node <skill>/scripts/new.mjs my-deck --style boardroom
node <skill>/scripts/build.mjs my-deck              # add --pptx for PowerPoint, --scheme dark, --style other
```

## Repo layout

```
skill/slide-creator/        ← the skill (this is what you copy/download)
  SKILL.md                  agent instructions
  styles/                   editorial, boardroom, plant-floor (style.json, style.css, guide.md, reference/)
  assets/base.css           shared layouts and components
  scripts/                  build, inspect, lint, new, doctor, samples, import_style.py
  references/               layouts, tokens, diagrams, charts, rubric, design basics
  workflows/new-style.md    create / import / change a style
  examples/showcase/        one deck using every layout
  samples/                  showcase rendered in each style
dev/                        maintainer tools (offline preview renderer) — not part of the skill
```

## Status

Version 0.1 — first cut. The style generator, linter, inspector and style importer have been run and
checked; the Marp, D2 and Vega-Lite steps are written against their documented APIs but have not yet been
run end-to-end (their npm packages weren't installable where this was built). First real run:
`npm install && npm run showcase`, then look at `examples/showcase/build/report.md`.
