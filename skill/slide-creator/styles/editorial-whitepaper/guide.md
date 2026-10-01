# Editorial whitepaper — style guide

## The look in one paragraph

The editorial style set as a printed guide rather than slides. US Letter landscape pages (11 × 8.5 in),
serif body text at reading size in two columns, plain sans-serif subheads, and a large serif page title.
The cover is a full-bleed clay page with the title top left; chapter dividers are full-bleed sage pages
with a small outlined "Chapter N" pill and a huge title at the bottom. It should feel like a well-made
technical guide someone prints and annotates — in the spirit of long-form guides such as Anthropic's
*Complete Guide to Building Skills for Claude*.

## When to use it

- Whitepapers, playbooks, guides and handbooks
- Pre-reads, handouts and reports that people **read** rather than watch
- Anything that needs more than ~80 words on a page

Not for: presenting on a screen to a room (use `editorial`, `boardroom` or `plant-floor` slides).

## Page types

| Page | How to write it |
|---|---|
| Cover | `<!-- _class: cover -->` + `<!-- _paginate: false -->`; `# Title`, one subtitle line, and a last line (author · date) which sits at the bottom |
| Contents | `<!-- _class: agenda -->`; `# Contents`; an ordered list with the page number in `*italics*` |
| Chapter divider | `<!-- _class: chapter -->` + `<!-- _paginate: false -->`; `###### Chapter 1` then `# Chapter title` |
| Body page | the default (`class: paper` in the front matter): `###### Chapter 1` pill, `# Page title`, then `##` / `###` sections, prose, lists, tables |

Put `class: paper` in the front matter so every page is a two-column body page unless it says otherwise.

## Signatures

1. Two columns; text fills the left column first, then the right — like a book, not balanced like a newspaper.
2. Serif body (Cambria, fallback Georgia) at 14 px ≈ 10.5 pt; Georgia page titles; Segoe UI / Aptos subheads.
3. "Chapter N" outlined pill above every page title in that chapter.
4. Tables: thin ink grid, tinted header row, small sans text.
5. Asides as one italic line with a coloured lead-in (`<p class="callout"><b>Tip:</b> …</p>`), not boxes.
6. Small page number bottom right; no header or footer text.

## Figures

- A chart or small diagram sits **in a column**: `![Alt](charts/name.svg)` between paragraphs. Charts are
  drawn 400 × 190 px by default, the column width, so their text prints at the right size. Don't set
  `width` in the chart spec.
- A wide diagram goes **across both columns**: wrap it in `<div class="figure"> … </div>` with a
  `<p class="caption">` under it. Put it straight after the page title so the text below starts level in
  both columns. Draw it left-to-right (`direction: right`) so it fills the width without getting tall.
- One figure per page.

## Colour

White page, near-black ink, warm tan `surface` (table headers), clay `accent` (cover, callout lead-ins,
the one highlighted bar or diagram node), sage `primary` (chapter pages). Body text is always ink.

## Writing

- Page titles name the section ("The method", "Results so far"); subheads are short phrases or questions.
- Paragraphs of 2–5 sentences. Lists for parallel items only; bold lead-ins (`**Film.** Record…`) are welcome.
- About 350–550 words per body page with one table or figure. The inspector reports an **overflow** error
  if text spills past the second column: cut text or move a section to the next page.
- Line breaks in the source don't matter — prose reflows (this style turns Markdown `breaks` off).

## Example

`examples/whitepaper/` — build it with `npm run whitepaper` and look at its contact sheet: that is the target.
